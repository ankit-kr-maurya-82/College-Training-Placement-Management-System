import test from "node:test";
import assert from "node:assert/strict";
import { Company } from "../src/models/company.model.js";
import { Drive } from "../src/models/drive.model.js";
import { DriveNotification } from "../src/models/drive-notification.model.js";
import { Student } from "../src/models/student.model.js";
import { processNotificationJob } from "../src/services/drive-notification-worker.js";
import { setTransportFactory } from "../src/services/vacancy-email.service.js";

const driveId = "507f1f77bcf86cd799439011";
const companyId = "507f1f77bcf86cd799439012";

function restoreEnv(t, names) {
    const previous = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    t.after(() => {
        for (const [name, value] of Object.entries(previous)) {
            if (value === undefined) delete process.env[name];
            else process.env[name] = value;
        }
        setTransportFactory(async (options) => (await import("nodemailer")).createTransport(options));
    });
}

function mockWorkerDependencies(t, sendMail, eligibility = { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 }) {
    const drive = {
        _id: driveId,
        company: companyId,
        title: "Test Engineer",
        description: "Build reliable systems",
        location: "Pune",
        ctc: "8 LPA",
        eligibility,
        applicationDeadline: new Date("2099-01-01"),
    };
    const students = [
        { _id: "student-1", email: "Candidate@Example.edu", cgpa: 8, department: "CSE", graduationYear: 2027, activeBacklogs: 0 },
        { _id: "student-2", email: "ineligible@example.edu", cgpa: 6, department: "CSE", graduationYear: 2027, activeBacklogs: 0 },
        { _id: "student-3", email: "candidate@example.edu", cgpa: 9, department: "CSE", graduationYear: 2027, activeBacklogs: 0 },
        { _id: "student-4", email: "invalid email", cgpa: 9, department: "CSE", graduationYear: 2027, activeBacklogs: 0 },
        { _id: "student-5", email: "no-education@example.edu" },
        { _id: "student-6", email: "wrong-branch@example.edu", cgpa: 9, department: "Arts", graduationYear: 2027, activeBacklogs: 0 },
        { _id: "student-7", email: "wrong-year@example.edu", cgpa: 9, department: "CSE", graduationYear: 2026, activeBacklogs: 0 },
        { _id: "student-8", email: "backlogs@example.edu", cgpa: 9, department: "CSE", graduationYear: 2027, activeBacklogs: 2 },
    ];
    const operations = [];
    const deliveryUpdates = [];
    let pendingRead = false;

    t.mock.method(Drive, "findOne", async (filter) => {
        assert.equal(String(filter._id), driveId);
        assert.equal(filter.status, "Published");
        return drive;
    });
    t.mock.method(Company, "findById", () => ({
        select: () => ({ lean: async () => ({ _id: companyId, name: "Test Company" }) }),
    }));
    t.mock.method(Student, "find", (filter) => {
        assert.deepEqual(filter, { isActive: { $ne: false } });
        return {
            select: () => ({
                lean: () => ({
                    cursor: () => ({
                        async *[Symbol.asyncIterator]() {
                            yield* students;
                        },
                    }),
                }),
            }),
        };
    });
    t.mock.method(Student, "countDocuments", async (filter) => {
        assert.deepEqual(filter, { isActive: false });
        return 1;
    });
    t.mock.method(DriveNotification, "bulkWrite", async (batch) => { operations.push(...batch); return { upsertedCount: batch.length }; });
    t.mock.method(DriveNotification, "find", () => ({
        select: () => ({
            limit: () => ({ lean: async () => {
                if (pendingRead) return [];
                pendingRead = true;
                return operations.length ? [{ _id: "delivery-1" }] : [];
            } }),
        }),
    }));
    t.mock.method(DriveNotification, "findOneAndUpdate", async (filter, update) => {
        assert.equal(String(filter._id), "delivery-1");
        assert.equal(filter.status, "PENDING");
        assert.equal(update.$inc.attemptCount, 1);
        return { _id: "delivery-1", email: "candidate@example.edu" };
    });
    t.mock.method(DriveNotification, "updateOne", async (...args) => { deliveryUpdates.push(args); });
    t.mock.method(DriveNotification, "countDocuments", async () => 0);
    const job = { _id: "job-1", drive: driveId, save: async () => {} };
    setTransportFactory(async () => ({ sendMail }));
    return { job, operations, deliveryUpdates };
}

test("notification job queues only eligible unique recipients and sends the configured Apply Now link", async (t) => {
    restoreEnv(t, ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "EMAIL_FROM", "SMTP_SECURE", "FRONTEND_URL"]);
    Object.assign(process.env, {
        SMTP_HOST: "smtp.test",
        SMTP_PORT: "587",
        SMTP_USER: "sender@example.test",
        SMTP_PASS: "mock-secret",
        FRONTEND_URL: "https://placements.example",
    });
    const messages = [];
    const { job, operations, deliveryUpdates } = mockWorkerDependencies(t, async (message) => { messages.push(message); });
    const diagnostics = [];
    t.mock.method(console, "info", (...args) => diagnostics.push(args));

    await processNotificationJob(job);

    assert.equal(operations.length, 1);
    assert.equal(operations[0].updateOne.filter.student, "student-1");
    assert.equal(operations[0].updateOne.update.$setOnInsert.email, "candidate@example.edu");
    assert.equal(messages.length, 1);
    assert.equal(messages[0].to, "candidate@example.edu");
    assert.match(messages[0].subject, /Test Engineer.*Test Company/);
    assert.match(messages[0].html, /Minimum CGPA: 7/);
    assert.match(messages[0].html, /Graduation year: 2027/);
    assert.match(messages[0].html, /Apply by/);
    assert.match(messages[0].html, /href="https:\/\/placements\.example\/drives\/507f1f77bcf86cd799439011"/);
    assert.match(messages[0].text, /Application deadline:/);
    assert.match(messages[0].text, /Apply Now: https:\/\/placements\.example\/drives\/507f1f77bcf86cd799439011/);
    assert.equal(deliveryUpdates.length, 1);
    assert.equal(deliveryUpdates[0][1].$set.status, "SENT");
    assert.equal(job.status, "DONE");
    const diagnosticText = JSON.stringify(diagnostics);
    assert.ok(diagnostics.some(([, payload]) => JSON.parse(payload).jobId === "job-1"));
    assert.ok(diagnostics.some(([, payload]) => JSON.parse(payload).eligibleRecipientCount === 1));
    const selection = diagnostics.map(([, payload]) => JSON.parse(payload)).find((payload) => payload.queueState === "RECIPIENTS_QUEUED");
    assert.deepEqual({
        totalStudentsReturned: selection.totalStudentsReturned,
        inactiveStudentCount: selection.inactiveStudentCount,
        invalidEmailCount: selection.invalidEmailCount,
        duplicateEmailCount: selection.duplicateEmailCount,
        missingEducationDataCount: selection.missingEducationDataCount,
        minCGPAExcludedCount: selection.minCGPAExcludedCount,
        allowedBranchesExcludedCount: selection.allowedBranchesExcludedCount,
        graduationYearExcludedCount: selection.graduationYearExcludedCount,
        maxBacklogsExcludedCount: selection.maxBacklogsExcludedCount,
        eligibleRecipientCount: selection.eligibleRecipientCount,
    }, {
        totalStudentsReturned: 8,
        inactiveStudentCount: 1,
        invalidEmailCount: 1,
        duplicateEmailCount: 1,
        missingEducationDataCount: 1,
        minCGPAExcludedCount: 1,
        allowedBranchesExcludedCount: 1,
        graduationYearExcludedCount: 1,
        maxBacklogsExcludedCount: 1,
        eligibleRecipientCount: 1,
    });
    assert.ok(diagnostics.some(([, payload]) => JSON.parse(payload).queueState === "SENT"));
    assert.doesNotMatch(diagnosticText, /candidate@example\.edu|mock-secret/);
});

test("notification job records SMTP delivery failures without exposing raw errors", async (t) => {
    restoreEnv(t, ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM", "EMAIL_FROM", "SMTP_SECURE", "FRONTEND_URL"]);
    Object.assign(process.env, {
        SMTP_HOST: "smtp.test",
        SMTP_PORT: "587",
        SMTP_USER: "sender@example.test",
        SMTP_PASS: "mock-secret",
    });
    const { job, operations, deliveryUpdates } = mockWorkerDependencies(t, async () => {
        const error = new Error("credential=do-not-log");
        error.code = "ECONNECTION";
        throw error;
    });
    const diagnostics = [];
    t.mock.method(console, "warn", (...args) => diagnostics.push(args));

    await processNotificationJob(job);

    assert.equal(operations.length, 1);
    assert.equal(deliveryUpdates.length, 1);
    assert.equal(deliveryUpdates[0][1].$set.status, "FAILED");
    assert.equal(deliveryUpdates[0][1].$set.lastError, "Email delivery failed (ECONNECTION)");
    assert.equal(job.status, "DONE");
    const diagnosticText = JSON.stringify(diagnostics);
    assert.ok(diagnostics.some(([, payload]) => JSON.parse(payload).jobId === "job-1"));
    assert.ok(diagnostics.some(([, payload]) => JSON.parse(payload).queueState === "FAILED"));
    assert.doesNotMatch(diagnosticText, /candidate@example\.edu|mock-secret|do-not-log/);
});

test("notification job records zero eligible recipients without attempting delivery", async (t) => {
    restoreEnv(t, ["FRONTEND_URL"]);
    const messages = [];
    const { job, operations } = mockWorkerDependencies(t, async (message) => { messages.push(message); }, {
        minCGPA: 10,
        allowedBranches: ["CSE"],
        graduationYear: 2027,
        maxBacklogs: 0,
    });
    const diagnostics = [];
    t.mock.method(console, "info", (...args) => diagnostics.push(args));

    await processNotificationJob(job);

    assert.equal(operations.length, 0);
    assert.equal(messages.length, 0);
    assert.equal(job.status, "DONE");
    assert.ok(diagnostics.some(([, payload]) => JSON.parse(payload).eligibleRecipientCount === 0));
});

test("notification job marks drive lookup failures failed instead of leaving the lease processing", async (t) => {
    t.mock.method(Drive, "findOne", async () => { throw new Error("mongodb-uri-secret"); });
    const diagnostics = [];
    t.mock.method(console, "info", (...args) => diagnostics.push(args));
    t.mock.method(console, "error", (...args) => diagnostics.push(args));
    const job = { _id: "job-lookup-failure", drive: driveId, save: async () => {} };

    await processNotificationJob(job);

    assert.equal(job.status, "FAILED");
    assert.equal(job.lastError, "Email delivery failed");
    assert.equal(job.leaseUntil, undefined);
    const diagnosticText = JSON.stringify(diagnostics);
    assert.ok(diagnostics.some(([, payload]) => JSON.parse(payload).jobId === "job-lookup-failure"));
    assert.ok(diagnostics.some(([, payload]) => JSON.parse(payload).queueState === "FAILED"));
    assert.doesNotMatch(diagnosticText, /mongodb-uri-secret/);
});
