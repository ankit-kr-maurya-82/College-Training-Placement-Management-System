import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Company } from "../src/models/company.model.js";
import { Drive } from "../src/models/drive.model.js";
import { DriveNotificationJob } from "../src/models/drive-notification-job.model.js";
import { closeDrive, createDrive, deleteDrive, getDriveById, getDrives, getManageDrives, publishDrive, updateDrive } from "../src/controllers/drive.controller.js";
import { authenticateToken } from "../src/middlewares/auth.middleware.js";
import { authorizeRoles } from "../src/middlewares/role.middleware.js";

const id = "507f1f77bcf86cd799439011";
const creatorId = "507f1f77bcf86cd799439012";
const validBody = {
    title: "Backend Engineer", company: id, description: "Build services", jobType: "Full-time",
    location: "Lucknow", workMode: "Hybrid", applicationDeadline: "2099-12-31T00:00:00.000Z",
    eligibility: { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 }, requiredSkills: ["Node.js"],
};
function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function chain(value) {
    const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query, populate: () => query, lean: async () => value };
    return query;
}
function driveDocument(overrides = {}) {
    return { _id: id, status: "Draft", applicationDeadline: new Date("2099-12-31"), company: id, save: async function () { return this; }, ...overrides };
}

describe("drive management", { concurrency: false }, () => {
    it("validates required fields, company IDs, and active company references on create", async (t) => {
        const companyLookup = t.mock.method(Company, "findOne", async () => ({ _id: id, isActive: true }));
        const create = t.mock.method(Drive, "create", async (doc) => doc);
        let res = response();
        await createDrive({ body: { ...validBody, title: " " }, user: { userId: creatorId } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        await createDrive({ body: { ...validBody, company: "bad" }, user: { userId: creatorId } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        await createDrive({ body: validBody, user: { userId: creatorId } }, res);
        assert.equal(res.statusCode, 201);
        assert.equal(create.mock.calls[0].arguments[0].status, "Draft");
        assert.equal(create.mock.calls[0].arguments[0].createdBy, creatorId);
        assert.equal(Object.hasOwn(create.mock.calls[0].arguments[0], "createdBy"), true);
        assert.equal(companyLookup.mock.callCount(), 1);
    });

    it("rejects a missing or inactive referenced company", async (t) => {
        t.mock.method(Company, "findOne", async () => null);
        const create = t.mock.method(Drive, "create", async () => assert.fail("must not create"));
        const res = response();
        await createDrive({ body: validBody, user: { userId: creatorId } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(create.mock.callCount(), 0);
    });

    it("lists only published, unexpired drives for active companies with pagination and filters", async (t) => {
        let driveFilter;
        let companyFilter;
        t.mock.method(Company, "find", (filter) => { companyFilter = filter; return chain([{ _id: id }]); });
        t.mock.method(Drive, "find", (filter) => { driveFilter = filter; return chain([{ _id: id, status: "Published" }]); });
        t.mock.method(Drive, "countDocuments", async () => 1);
        const res = response();
        await getDrives({ query: { page: "2", limit: "5", search: "backend", company: id, location: "Lucknow", jobType: "Full-time", workMode: "Hybrid" } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(companyFilter.isActive, true);
        assert.equal(driveFilter.status, "Published");
        assert.ok(driveFilter.applicationDeadline.$gt instanceof Date);
        assert.deepEqual(driveFilter.company.$in, [id]);
        assert.equal(driveFilter.location.$regex, "Lucknow");
        assert.equal(driveFilter.$or[0].title.$regex, "backend");
        assert.deepEqual(res.body.pagination, { page: 2, limit: 5, total: 1, pages: 1 });
    });

    it("provides the manager inventory with drafts and closed drives for pagination", async (t) => {
        const rows = [{ _id: id, status: "Draft" }, { _id: creatorId, status: "Closed" }];
        let filter;
        t.mock.method(Drive, "find", (query) => { filter = query; return chain(rows); });
        t.mock.method(Drive, "countDocuments", async () => 2);
        const res = response();
        await getManageDrives({ query: { page: "1", limit: "1" } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(filter, {});
        assert.deepEqual(res.body.drives, rows);
        assert.deepEqual(res.body.pagination, { page: 1, limit: 1, total: 2, pages: 2 });
    });

    it("retrieves published drives and hides drafts or expired drives", async (t) => {
        t.mock.method(Company, "find", () => chain([{ _id: id }]));
        let filter;
        let matchingDrive = { _id: id };
        t.mock.method(Drive, "findOne", (query) => { filter = query; return chain(matchingDrive); });
        let res = response();
        await getDriveById({ params: { id: "invalid" } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        await getDriveById({ params: { id } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(filter.status, "Published");
        assert.ok(filter.applicationDeadline.$gt instanceof Date);
        matchingDrive = null;
        res = response();
        await getDriveById({ params: { id } }, res);
        assert.equal(res.statusCode, 404);
    });

    it("updates a drive without accepting protected fields", async (t) => {
        const document = driveDocument();
        t.mock.method(Drive, "findById", async () => document);
        const res = response();
        await updateDrive({ params: { id }, body: { title: " Updated ", status: "Published", createdBy: creatorId } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(document.title, "Updated");
        assert.equal(document.status, "Draft");
        assert.equal(document.createdBy, undefined);
    });

    it("publishes only future draft drives and closes only published drives", async (t) => {
        let document = driveDocument();
        t.mock.method(Drive, "findById", async () => document);
        t.mock.method(Drive, "findOneAndUpdate", async (filter) => { assert.equal(filter.status, "Draft"); document.status = "Published"; return document; });
        const enqueue = t.mock.method(DriveNotificationJob, "findOneAndUpdate", async () => ({ _id: "notification-job", status: "PENDING" }));
        t.mock.method(Company, "findOne", async () => ({ _id: id, isActive: true }));
        let res = response();
        await publishDrive({ params: { id } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(document.status, "Published");
        assert.equal(res.body.notificationsQueued, true);
        assert.equal(enqueue.mock.callCount(), 1);
        res = response();
        await publishDrive({ params: { id } }, res);
        assert.equal(res.statusCode, 409);
        assert.equal(enqueue.mock.callCount(), 1);
        res = response();
        await closeDrive({ params: { id } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(document.status, "Closed");
        res = response();
        await publishDrive({ params: { id } }, res);
        assert.equal(res.statusCode, 409);
    });

    it("does not publish an expired draft", async (t) => {
        const document = driveDocument({ applicationDeadline: new Date("2000-01-01") });
        t.mock.method(Drive, "findById", async () => document);
        t.mock.method(Drive, "findOneAndUpdate", async () => assert.fail("expired drive must not transition"));
        const res = response();
        await publishDrive({ params: { id } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(document.status, "Draft");
    });

    it("prevents a company from publishing another company's drive", async (t) => {
        t.mock.method(Drive, "findById", async () => driveDocument({ company: "507f1f77bcf86cd799439099" }));
        const companyLookup = t.mock.method(Company, "findOne", async () => assert.fail("foreign drive must not be published"));
        const enqueue = t.mock.method(DriveNotificationJob, "findOneAndUpdate", async () => assert.fail("foreign drive must not be queued"));
        const res = response();
        await publishDrive({ params: { id }, user: { role: "COMPANY", companyId: id } }, res);
        assert.equal(res.statusCode, 403);
        assert.equal(companyLookup.mock.callCount(), 0);
        assert.equal(enqueue.mock.callCount(), 0);
    });

    it("keeps a vacancy published when notification queue storage fails", async (t) => {
        const document = driveDocument();
        t.mock.method(Drive, "findById", async () => document);
        t.mock.method(Drive, "findOneAndUpdate", async () => { document.status = "Published"; return document; });
        t.mock.method(Company, "findOne", async () => ({ _id: id, isActive: true }));
        t.mock.method(DriveNotificationJob, "findOneAndUpdate", async () => { throw new Error("database unavailable"); });
        const res = response();
        await publishDrive({ params: { id } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(document.status, "Published");
        assert.equal(res.body.notificationsQueued, false);
    });

    it("deletes existing drives and reports missing drives", async (t) => {
        t.mock.method(Drive, "findById", async () => null);
        t.mock.method(Drive, "findByIdAndDelete", async () => null);
        const res = response();
        await deleteDrive({ params: { id } }, res);
        assert.equal(res.statusCode, 404);
        assert.equal(res.body.message, "Drive not found");
    });
});

describe("drive write authorization", () => {
    it("rejects missing authentication and non-admin roles", () => {
        const unauthorized = response();
        authenticateToken({ get: () => undefined }, unauthorized, () => assert.fail("missing token must fail"));
        assert.equal(unauthorized.statusCode, 401);
        const forbidden = response();
        authorizeRoles("ADMIN", "TPO")({ user: { role: "STUDENT" } }, forbidden, () => assert.fail("student must fail"));
        assert.equal(forbidden.statusCode, 403);
    });
});
