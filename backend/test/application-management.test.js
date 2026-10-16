import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Application } from "../src/models/application.model.js";
import { Company } from "../src/models/company.model.js";
import { Drive } from "../src/models/drive.model.js";
import { Student } from "../src/models/student.model.js";
import {
    applyForDrive,
    getApplicationById,
    getApplications,
    getMyApplications,
    updateApplicationStatus,
    withdrawApplication,
} from "../src/controllers/application.controller.js";
import { authenticateToken } from "../src/middlewares/auth.middleware.js";
import { authorizeRoles } from "../src/middlewares/role.middleware.js";

const studentId = "507f1f77bcf86cd799439011";
const otherStudentId = "507f1f77bcf86cd799439012";
const driveId = "507f1f77bcf86cd799439013";
const applicationId = "507f1f77bcf86cd799439014";
const adminId = "507f1f77bcf86cd799439015";
const resumeUrl = "https://files.example.edu/resume.pdf";

function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function queryChain(value) {
    const query = {
        sort: () => query, skip: () => query, limit: () => query, populate: () => query,
        lean: async () => value,
    };
    return query;
}
function eligibleStudent(overrides = {}) {
    return { _id: studentId, cgpa: 8, department: "CSE", course: "B.Tech", graduationYear: 2027, activeBacklogs: 0, resumeUrl, ...overrides };
}
function publishedDrive(overrides = {}) {
    return { _id: driveId, company: "507f1f77bcf86cd799439016", status: "Published", applicationDeadline: new Date("2099-12-31"), eligibility: { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 }, ...overrides };
}
function applicationDocument(overrides = {}) {
    return {
        _id: applicationId, student: studentId, status: "Applied", statusHistory: [],
        save: async function () { return this; }, ...overrides,
    };
}

describe("student applications", { concurrency: false }, () => {
    it("submits an eligible application using the authenticated student, not a body student ID", async (t) => {
        const student = eligibleStudent();
        const drive = publishedDrive();
        t.mock.method(Student, "findById", async () => student);
        t.mock.method(Drive, "findById", async () => drive);
        t.mock.method(Company, "findById", async () => ({ isActive: true }));
        const create = t.mock.method(Application, "create", async (value) => value);
        const res = response();
        await applyForDrive({ user: { studentId }, body: { driveId, studentId: otherStudentId, coverLetter: "  Hello  " } }, res);
        assert.equal(res.statusCode, 201);
        const input = create.mock.calls[0].arguments[0];
        assert.equal(String(input.student), studentId);
        assert.equal(input.status, "Applied");
        assert.equal(input.resumeUrl, resumeUrl);
        assert.equal(input.coverLetter, "Hello");
        assert.equal(input.statusHistory[0].status, "Applied");
        assert.equal(String(input.statusHistory[0].changedBy), studentId);
        assert.equal(Object.hasOwn(input, "studentId"), false);
    });

    it("rejects invalid drive IDs, inactive drives, expired drives, and missing resumes", async (t) => {
        const student = eligibleStudent({ resumeUrl: undefined });
        t.mock.method(Student, "findById", async () => student);
        let drive = publishedDrive();
        t.mock.method(Drive, "findById", async () => drive);
        t.mock.method(Company, "findById", async () => ({ isActive: true }));
        const create = t.mock.method(Application, "create", async () => assert.fail("must not create"));
        let res = response();
        await applyForDrive({ user: { studentId }, body: { driveId: "bad", resumeUrl } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        drive = null;
        await applyForDrive({ user: { studentId }, body: { driveId, resumeUrl } }, res);
        assert.equal(res.statusCode, 404);
        res = response();
        drive = publishedDrive({ status: "Draft" });
        await applyForDrive({ user: { studentId }, body: { driveId } }, res);
        assert.equal(res.statusCode, 409);
        res = response();
        drive = publishedDrive({ applicationDeadline: new Date("2000-01-01") });
        await applyForDrive({ user: { studentId }, body: { driveId } }, res);
        assert.equal(res.statusCode, 409);
        res = response();
        drive = publishedDrive();
        await applyForDrive({ user: { studentId }, body: { driveId } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        await applyForDrive({ user: { studentId }, body: { driveId, resumeUrl: "file:///secret.pdf" } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(create.mock.callCount(), 0);
    });

    it("rejects students who do not meet eligibility and prevents duplicate applications", async (t) => {
        let student = eligibleStudent({ cgpa: 6 });
        t.mock.method(Student, "findById", async () => student);
        t.mock.method(Drive, "findById", async () => publishedDrive());
        t.mock.method(Company, "findById", async () => ({ isActive: true }));
        const create = t.mock.method(Application, "create", async () => { throw Object.assign(new Error("duplicate"), { code: 11000 }); });
        const ineligible = response();
        await applyForDrive({ user: { studentId }, body: { driveId, resumeUrl } }, ineligible);
        assert.equal(ineligible.statusCode, 403);
        assert.equal(create.mock.callCount(), 0);

        student = eligibleStudent();
        const duplicate = response();
        await applyForDrive({ user: { studentId }, body: { driveId, resumeUrl } }, duplicate);
        assert.equal(duplicate.statusCode, 409);
    });

    it("lists only the signed-in student's applications with pagination and status filter", async (t) => {
        let filter;
        let populateCalls = 0;
        const populateArgs = [];
        const find = t.mock.method(Application, "find", (query) => {
            filter = query;
            const storedHistory = [{ status: "Applied", changedAt: new Date("2026-01-10T10:00:00Z"), changedBy: studentId }];
            const q = queryChain([{ _id: applicationId, status: "Applied", statusHistory: storedHistory }]);
            const originalPopulate = q.populate;
            q.populate = (...args) => { populateCalls += 1; populateArgs.push(args[0]); return originalPopulate(...args); };
            return q;
        });
        t.mock.method(Application, "countDocuments", async () => 3);
        t.mock.method(Application, "aggregate", async () => [
            { _id: "Applied", count: 2 },
            { _id: "Under Review", count: 1 },
            { _id: "Interview Scheduled", count: 1 },
            { _id: "Shortlisted", count: 1 },
            { _id: "Selected", count: 1 },
            { _id: "Rejected", count: 1 },
            { _id: "Withdrawn", count: 1 },
        ]);
        const res = response();
        await getMyApplications({ user: { studentId }, query: { page: "2", limit: "2", status: "Shortlisted", student: otherStudentId } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(filter, { student: studentId, status: "Shortlisted" });
        assert.equal(find.mock.callCount(), 1);
        assert.equal(populateCalls, 2);
        assert.match(populateArgs[0].select, /description/);
        assert.match(populateArgs[0].select, /eligibility/);
        assert.deepEqual(res.body.pagination, { page: 2, limit: 2, total: 3, pages: 2 });
        assert.deepEqual(res.body.summary, { total: 8, pending: 4, shortlisted: 1, selected: 1, rejected: 1 });
        assert.deepEqual(res.body.applications[0].statusHistory, [{ status: "Applied", changedAt: new Date("2026-01-10T10:00:00Z"), changedBy: studentId }]);
    });

    it("searches owned applications by drive or company and filters inclusive application dates", async (t) => {
        let applicationFilter;
        const resultQuery = (value) => {
            const query = { select: () => query, lean: async () => value };
            return query;
        };
        t.mock.method(Company, "find", (filter) => {
            assert.ok(filter.$or.some((entry) => entry.name));
            return resultQuery([{ _id: "507f1f77bcf86cd799439017" }]);
        });
        t.mock.method(Drive, "find", (filter) => {
            assert.ok(filter.$or.some((entry) => entry.title));
            return resultQuery([{ _id: driveId }]);
        });
        t.mock.method(Application, "find", (filter) => {
            applicationFilter = filter;
            return queryChain([]);
        });
        t.mock.method(Application, "countDocuments", async () => 0);
        t.mock.method(Application, "aggregate", async () => []);
        const res = response();
        await getMyApplications({ user: { studentId }, query: { search: "engineer", from: "2026-02-01", to: "2026-02-28" } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(applicationFilter.student, studentId);
        assert.deepEqual(applicationFilter.drive, { $in: [driveId] });
        assert.deepEqual(applicationFilter.appliedAt, { $gte: new Date("2026-02-01T00:00:00.000Z"), $lt: new Date("2026-03-01T00:00:00.000Z") });
        assert.deepEqual(res.body.summary, { total: 0, pending: 0, shortlisted: 0, selected: 0, rejected: 0 });
    });

    it("enforces ownership for individual application views", async (t) => {
        const application = { _id: applicationId, student: { _id: otherStudentId } };
        t.mock.method(Application, "findById", () => queryChain(application));
        let res = response();
        await getApplicationById({ user: { studentId }, params: { id: applicationId } }, res);
        assert.equal(res.statusCode, 403);
        res = response();
        await getApplicationById({ user: { studentId }, params: { id: "bad" } }, res);
        assert.equal(res.statusCode, 400);
    });

    it("allows withdrawal for owned active applications and blocks terminal statuses", async (t) => {
        let application = applicationDocument();
        t.mock.method(Application, "findById", async () => application);
        let res = response();
        await withdrawApplication({ user: { studentId }, params: { id: applicationId }, body: { note: "  Changed plans  " } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(application.status, "Withdrawn");
        assert.equal(application.statusHistory[0].note, "Changed plans");
        application = applicationDocument({ status: "Selected" });
        res = response();
        await withdrawApplication({ user: { studentId }, params: { id: applicationId }, body: {} }, res);
        assert.equal(res.statusCode, 409);
        application = applicationDocument({ student: otherStudentId });
        res = response();
        await withdrawApplication({ user: { studentId }, params: { id: applicationId }, body: {} }, res);
        assert.equal(res.statusCode, 403);
    });

    it("allows Admin/TPO status transitions and records history; blocks invalid transitions", async (t) => {
        let application = applicationDocument();
        t.mock.method(Application, "findById", async () => application);
        let res = response();
        await updateApplicationStatus({ user: { role: "ADMIN", userId: adminId }, params: { id: applicationId }, body: { status: "Under Review", note: "Reviewed" } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(application.status, "Under Review");
        assert.equal(String(application.statusHistory[0].changedBy), adminId);
        assert.equal(application.statusHistory[0].note, "Reviewed");
        application = applicationDocument({ status: "Rejected" });
        res = response();
        await updateApplicationStatus({ user: { role: "TPO", userId: adminId }, params: { id: applicationId }, body: { status: "Selected" } }, res);
        assert.equal(res.statusCode, 409);
        res = response();
        await updateApplicationStatus({ user: { role: "TPO", userId: adminId }, params: { id: applicationId }, body: { status: "Withdrawn" } }, res);
        assert.equal(res.statusCode, 400);
    });

    it("provides an Admin/TPO listing and validates status filters", async (t) => {
        let filter;
        t.mock.method(Application, "find", (query) => { filter = query; return queryChain([]); });
        t.mock.method(Application, "countDocuments", async () => 0);
        let res = response();
        await getApplications({ query: { status: "Applied", page: "1", limit: "10" } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(filter.status, "Applied");
        res = response();
        await getApplications({ query: { status: "Unknown" } }, res);
        assert.equal(res.statusCode, 400);
    });
});

describe("application authorization", () => {
    it("rejects anonymous and non-Admin/TPO access to manager routes", () => {
        const anonymous = response();
        authenticateToken({ get: () => undefined }, anonymous, () => assert.fail("must require authentication"));
        assert.equal(anonymous.statusCode, 401);
        const forbidden = response();
        authorizeRoles("ADMIN", "TPO")({ user: { studentId } }, forbidden, () => assert.fail("students cannot manage all applications"));
        assert.equal(forbidden.statusCode, 403);
    });
});
