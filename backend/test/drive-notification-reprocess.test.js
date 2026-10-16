import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { app } from "../src/app.js";
import { Company } from "../src/models/company.model.js";
import { Drive } from "../src/models/drive.model.js";
import { DriveNotification } from "../src/models/drive-notification.model.js";
import { DriveNotificationJob } from "../src/models/drive-notification-job.model.js";
import { Student } from "../src/models/student.model.js";
import { reprocessCompanyNotifications } from "../src/controllers/drive-notification.controller.js";
import { processNotificationJob } from "../src/services/drive-notification-worker.js";
import { setTransportFactory } from "../src/services/vacancy-email.service.js";

const driveId = "507f1f77bcf86cd799439011";
const companyId = "507f1f77bcf86cd799439012";
const secret = "notification-reprocess-route-test-secret";
const drive = {
    _id: driveId,
    company: companyId,
    status: "Published",
    applicationDeadline: new Date("2099-01-01"),
    eligibility: { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 },
};

function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function mockDrive(t, found = drive) {
    return t.mock.method(Drive, "findOne", (filter) => {
        assert.equal(String(filter._id), driveId);
        assert.equal(String(filter.company), companyId);
        return { select: () => ({ lean: async () => found }) };
    });
}

function mockEligibleStudent(t) {
    t.mock.method(Company, "findById", () => ({ select: () => ({ lean: async () => ({ name: "Test Company" }) }) }));
    t.mock.method(Student, "countDocuments", async () => 0);
    t.mock.method(Student, "find", (filter) => {
        assert.deepEqual(filter, { isActive: { $ne: false } });
        return { select: () => ({ lean: () => ({ cursor: () => ({
            async *[Symbol.asyncIterator]() {
                // This is the student's current profile after completing it.
                yield { _id: "507f1f77bcf86cd799439013", email: "new.student@example.edu", department: "CSE", cgpa: 8, graduationYear: 2027, activeBacklogs: 0 };
            },
        }) }) }) };
    });
}

function processingJob(overrides = {}) {
    return {
        _id: "507f1f77bcf86cd799439014",
        drive: driveId,
        status: "PROCESSING",
        save: async function () { this.saveCount = (this.saveCount ?? 0) + 1; },
        ...overrides,
    };
}

describe("company vacancy notification reprocessing", { concurrency: false }, () => {
    let server;
    let originalSecret;

    before(async () => {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
    });

    after(async () => {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
                server.closeAllConnections();
            });
        }
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    it("requires company authentication on the reprocess endpoint", async () => {
        const result = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/companies/me/drives/${driveId}/notifications/reprocess`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: "{}",
        });
        assert.equal(result.status, 401);
        assert.deepEqual(await result.json(), { message: "Authentication required" });
    });

    it("reselects a newly eligible student for a DONE job with no previous deliveries", async (t) => {
        mockDrive(t);
        mockEligibleStudent(t);
        const job = processingJob({ status: "DONE" });
        let queuedOperations;
        t.mock.method(DriveNotificationJob, "findOneAndUpdate", async (filter, update) => {
            assert.equal(String(filter.drive), driveId);
            assert.ok(filter.$or.some((entry) => entry.status?.$in?.includes("DONE")));
            assert.equal(update.$set.status, "PROCESSING");
            return job;
        });
        const bulkWrite = t.mock.method(DriveNotification, "bulkWrite", async (operations) => {
            queuedOperations = structuredClone(operations);
            return { upsertedCount: 1 };
        });
        t.mock.method(DriveNotification, "countDocuments", async (filter) => {
            assert.equal(filter.status, "FAILED");
            return 0;
        });

        const res = response();
        await reprocessCompanyNotifications({ params: { id: driveId }, user: { companyId } }, res);

        assert.equal(res.statusCode, 202);
        assert.equal(res.body.reprocessQueued, true);
        assert.deepEqual(res.body.summary, {
            newlyQueued: 1,
            alreadyExisting: 0,
            failedRecords: 0,
            ineligible: {
                inactive: 0,
                invalidEmail: 0,
                duplicateEmail: 0,
                missingEducationData: 0,
                minCGPA: 0,
                allowedBranches: 0,
                graduationYear: 0,
                maxBacklogs: 0,
            },
        });
        assert.equal(queuedOperations[0].updateOne.filter.student, "507f1f77bcf86cd799439013");
        assert.deepEqual(queuedOperations[0].updateOne.update.$setOnInsert, {
            drive: driveId,
            student: "507f1f77bcf86cd799439013",
            email: "new.student@example.edu",
            status: "PENDING",
            attemptCount: 0,
        });
        assert.equal(job.status, "PENDING");
        assert.equal(job.selectionSummary.newlyQueued, 1);
        assert.equal(bulkWrite.mock.callCount(), 1);
        assert.doesNotMatch(JSON.stringify(res.body), /new.student@example.edu/);
    });

    it("rejects invalid IDs and hides vacancies not owned by the signed-in company", async (t) => {
        let lookupCount = 0;
        t.mock.method(Drive, "findOne", (filter) => {
            lookupCount += 1;
            assert.equal(String(filter.company), companyId);
            return { select: () => ({ lean: async () => null }) };
        });
        const invalid = response();
        await reprocessCompanyNotifications({ params: { id: "bad-id" }, user: { companyId } }, invalid);
        assert.equal(invalid.statusCode, 400);
        const foreign = response();
        await reprocessCompanyNotifications({ params: { id: driveId }, user: { companyId } }, foreign);
        assert.equal(foreign.statusCode, 404);
        assert.equal(lookupCount, 1);
    });

    it("does not start a second scan while the job is pending or actively processing", async (t) => {
        mockDrive(t);
        let scanCount = 0;
        t.mock.method(Student, "find", () => { scanCount += 1; assert.fail("an active queue must not start a duplicate scan"); });
        t.mock.method(DriveNotificationJob, "findOneAndUpdate", async () => null);
        t.mock.method(DriveNotificationJob, "findOne", () => ({ select: () => ({ lean: async () => ({ status: "PROCESSING" }) }) }));
        const res = response();
        await reprocessCompanyNotifications({ params: { id: driveId }, user: { companyId } }, res);
        assert.equal(res.statusCode, 409);
        assert.equal(scanCount, 0);
    });

    it("returns the prior selection summary on a duplicate request while a job is pending", async (t) => {
        mockDrive(t);
        const summary = { newlyQueued: 1, alreadyExisting: 0, failedRecords: 0, ineligible: { minCGPA: 2 } };
        t.mock.method(DriveNotificationJob, "findOneAndUpdate", async () => null);
        t.mock.method(DriveNotificationJob, "findOne", () => ({ select: () => ({ lean: async () => ({ status: "PENDING", selectionSummary: summary }) }) }));
        const studentFind = t.mock.method(Student, "find", () => assert.fail("duplicate request must not rescan"));
        const res = response();
        await reprocessCompanyNotifications({ params: { id: driveId }, user: { companyId } }, res);
        assert.equal(res.statusCode, 202);
        assert.equal(res.body.reprocessQueued, false);
        assert.deepEqual(res.body.summary, summary);
        assert.equal(studentFind.mock.callCount(), 0);
    });

    it("preserves an existing SENT record and does not send it again", async (t) => {
        t.after(() => setTransportFactory(async (options) => (await import("nodemailer")).createTransport(options)));
        let sendMailCalls = 0;
        setTransportFactory(async () => ({ sendMail: async () => { sendMailCalls += 1; } }));
        t.mock.method(Drive, "findOne", async () => drive);
        mockEligibleStudent(t);
        const operations = [];
        t.mock.method(DriveNotification, "bulkWrite", async (batch) => {
            operations.push(...structuredClone(batch));
            return { upsertedCount: 0 };
        });
        t.mock.method(DriveNotification, "find", (filter) => {
            assert.equal(filter.status, "PENDING");
            return { select: () => ({ limit: () => ({ lean: async () => [] }) }) };
        });
        t.mock.method(DriveNotification, "countDocuments", async (filter) => {
            assert.equal(filter.status, "PENDING");
            return 0;
        });
        const job = processingJob();

        await processNotificationJob(job);

        assert.equal(job.status, "DONE");
        assert.equal(sendMailCalls, 0);
        assert.equal(operations.length, 1);
        assert.deepEqual(operations[0].updateOne.update.$setOnInsert, {
            drive: driveId,
            student: "507f1f77bcf86cd799439013",
            email: "new.student@example.edu",
            status: "PENDING",
            attemptCount: 0,
        });
    });

    it("marks a claimed job failed if selection persistence fails so it can be recovered", async (t) => {
        mockDrive(t);
        mockEligibleStudent(t);
        const job = processingJob({ status: "DONE" });
        const claims = t.mock.method(DriveNotificationJob, "findOneAndUpdate", async (filter) => {
            assert.ok(filter.$or.some((entry) => entry.status?.$in?.includes("FAILED")));
            return job;
        });
        let bulkCalls = 0;
        t.mock.method(DriveNotification, "bulkWrite", async () => {
            bulkCalls += 1;
            if (bulkCalls === 1) throw new Error("database error with private details");
            return { upsertedCount: 1 };
        });
        t.mock.method(DriveNotification, "countDocuments", async () => 0);
        t.mock.method(console, "error", () => {});
        const failed = response();
        await reprocessCompanyNotifications({ params: { id: driveId }, user: { companyId } }, failed);
        assert.equal(failed.statusCode, 500);
        assert.equal(job.status, "FAILED");
        assert.equal(job.lastError, "Recipient reprocessing failed");
        assert.equal(job.leaseUntil, undefined);
        assert.doesNotMatch(JSON.stringify(failed.body), /private details/);

        const recovered = response();
        await reprocessCompanyNotifications({ params: { id: driveId }, user: { companyId } }, recovered);
        assert.equal(recovered.statusCode, 202);
        assert.equal(recovered.body.reprocessQueued, true);
        assert.equal(job.status, "PENDING");
        assert.equal(claims.mock.callCount(), 2);
    });
});
