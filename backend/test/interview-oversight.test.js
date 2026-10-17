import assert from "node:assert/strict";
import { describe, it } from "node:test";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { Interview } from "../src/models/interview.model.js";
import { getInterviewOversight } from "../src/controllers/interview.controller.js";
import { authenticateToken } from "../src/middlewares/auth.middleware.js";
import { authorizeRoles } from "../src/middlewares/role.middleware.js";

const companyId = "507f1f77bcf86cd799439011";
const interviewId = "507f1f77bcf86cd799439012";

function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function query(value) {
    const chain = {
        select: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        populate: () => chain,
        lean: async () => value,
    };
    return chain;
}

const interview = {
    _id: interviewId,
    startAt: new Date("2026-06-02T09:00:00.000Z"),
    endAt: new Date("2026-06-02T10:00:00.000Z"),
    timeZone: "Asia/Kolkata",
    mode: "ONLINE",
    status: "SCHEDULED",
    student: { _id: "student-id", name: "Ada Student", rollNumber: "A001", department: "CSE", course: "B.Tech", email: "private@example.edu" },
    company: { _id: companyId, name: "Example Co", hrEmail: "private-hr@example.com" },
    drive: { _id: "drive-id", title: "Engineer", location: "Remote" },
    application: { _id: "application-id", status: "Interview Scheduled", resumeUrl: "private-resume" },
    meetingLink: "https://private.example/room",
    events: [{
        action: "SCHEDULED", changedAt: new Date("2026-06-01T09:00:00.000Z"), changedBy: "private-actor",
        notificationStatus: "SENT", requestId: "private-request", note: "private note",
    }],
};

describe("Admin/TPO interview oversight", { concurrency: false }, () => {
    it("accepts only verified ADMIN/TPO token roles and denies anonymous, student, and company roles", (t) => {
        const secret = "interview-oversight-test-secret";
        const previousSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        t.after(() => {
            if (previousSecret === undefined) delete process.env.JWT_SECRET;
            else process.env.JWT_SECRET = previousSecret;
        });
        const managerGuard = authorizeRoles("ADMIN", "TPO");
        for (const role of ["ADMIN", "TPO"]) {
            const token = jwt.sign({ role, userId: "verified-manager" }, secret);
            const req = { get: () => `Bearer ${token}` };
            const res = response();
            let nextCalled = false;
            authenticateToken(req, res, () => managerGuard(req, res, () => { nextCalled = true; }));
            assert.equal(nextCalled, true, `${role} should pass the verified manager guard`);
        }
        for (const role of ["STUDENT", "COMPANY"]) {
            const token = jwt.sign({ role, studentId: "student", companyId: "company" }, secret);
            const req = { get: () => `Bearer ${token}` };
            const res = response();
            authenticateToken(req, res, () => managerGuard(req, res, () => assert.fail(`${role} must not access institution-wide data`)));
            assert.equal(res.statusCode, 403);
        }
        const anonymousRes = response();
        authenticateToken({ get: () => "" }, anonymousRes, () => assert.fail("anonymous requests must not continue"));
        assert.equal(anonymousRes.statusCode, 401);
    });

    it("returns paginated interviews and filter-wide status and delivery summaries with minimized data", async (t) => {
        let findFilter;
        let countFilter;
        let pipeline;
        let pagination;
        t.mock.method(Interview, "countDocuments", async (filter) => { countFilter = filter; return 23; });
        t.mock.method(Interview, "aggregate", async (value) => { pipeline = value; return [{
            byStatus: [{ _id: "SCHEDULED", count: 23 }],
            notificationEvents: [{ _id: "SENT", count: 22 }, { _id: "FAILED", count: 1 }],
        }]; });
        t.mock.method(Interview, "find", (filter) => {
            findFilter = filter;
            const chain = query([interview]);
            const skip = chain.skip;
            chain.skip = (value) => { pagination = { ...pagination, skip: value }; return skip(value); };
            const limit = chain.limit;
            chain.limit = (value) => { pagination = { ...pagination, limit: value }; return limit(value); };
            return chain;
        });
        const res = response();
        await getInterviewOversight({ query: { page: "2", limit: "10", startDate: "2026-06-01", endDate: "2026-06-02", status: "SCHEDULED", company: companyId } }, res);

        assert.equal(res.statusCode, 200);
        assert.deepEqual(pagination, { skip: 10, limit: 10 });
        assert.equal(findFilter.status, "SCHEDULED");
        assert.ok(findFilter.company instanceof mongoose.Types.ObjectId);
        assert.deepEqual(findFilter.startAt, { $gte: new Date("2026-06-01T00:00:00.000Z"), $lte: new Date("2026-06-02T23:59:59.999Z") });
        assert.deepEqual(countFilter, findFilter);
        assert.deepEqual(pipeline[0].$match, findFilter);
        assert.equal(pipeline[1].$facet.byStatus[0].$group._id, "$status", "interview statuses are counted before event unwinding");
        assert.equal(pipeline[1].$facet.notificationEvents[0].$unwind, "$events");
        assert.equal(res.body.pagination.total, 23);
        assert.equal(res.body.summary.totalInterviews, 23);
        assert.equal(res.body.summary.interviewsByStatus.find((row) => row.status === "SCHEDULED").count, 23);
        assert.deepEqual(res.body.summary.notificationEventsByStatus, [{ status: "SENT", count: 22 }, { status: "FAILED", count: 1 }]);
        assert.equal(res.body.summary.notificationEventCount, 23);
        assert.equal(res.body.interviews[0].student.name, "Ada Student");
        assert.equal(res.body.interviews[0].student.email, undefined);
        assert.equal(res.body.interviews[0].company.hrEmail, undefined);
        assert.equal(res.body.interviews[0].meetingLink, undefined);
        assert.equal(res.body.interviews[0].application.resumeUrl, undefined);
        assert.equal(res.body.interviews[0].events[0].changedBy, undefined);
        assert.equal(res.body.interviews[0].events[0].requestId, undefined);
        assert.equal(res.body.interviews[0].events[0].note, undefined);
    });

    it("returns zero summaries for an empty result set", async (t) => {
        t.mock.method(Interview, "find", () => query([]));
        t.mock.method(Interview, "countDocuments", async () => 0);
        t.mock.method(Interview, "aggregate", async () => [{ byStatus: [], notificationEvents: [] }]);
        const res = response();
        await getInterviewOversight({ query: {} }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.interviews, []);
        assert.deepEqual(res.body.pagination, { page: 1, limit: 20, total: 0, pages: 0 });
        assert.deepEqual(res.body.summary.interviewsByStatus, [
            { status: "SCHEDULED", count: 0 }, { status: "COMPLETED", count: 0 }, { status: "CANCELLED", count: 0 },
        ]);
        assert.deepEqual(res.body.summary.notificationEventsByStatus, []);
        assert.equal(res.body.summary.notificationEventCount, 0);
    });

    it("keeps summaries independent of pagination at the page boundary", async (t) => {
        let skipValue;
        const chain = query([]);
        const skip = chain.skip;
        chain.skip = (value) => { skipValue = value; return skip(value); };
        t.mock.method(Interview, "find", () => chain);
        t.mock.method(Interview, "countDocuments", async () => 1);
        t.mock.method(Interview, "aggregate", async () => [{ byStatus: [{ _id: "COMPLETED", count: 1 }], notificationEvents: [] }]);
        const res = response();
        await getInterviewOversight({ query: { page: "2", limit: "1" } }, res);
        assert.equal(skipValue, 1);
        assert.deepEqual(res.body.interviews, []);
        assert.equal(res.body.pagination.total, 1);
        assert.equal(res.body.summary.interviewsByStatus.find((row) => row.status === "COMPLETED").count, 1);
    });

    it("rejects unsupported statuses, malformed company IDs, bad dates, reversed ranges, and invalid pagination before querying", async (t) => {
        const find = t.mock.method(Interview, "find", () => assert.fail("invalid filters must not query"));
        const cases = [
            { status: "UNKNOWN" }, { company: "invalid" }, { startDate: "2026-02-30" },
            { startDate: "2026-06-03", endDate: "2026-06-02" }, { startDate: "2020-01-01", endDate: "2026-01-01" },
            { page: "0" }, { limit: "101" }, { startDate: "yesterday" }, { status: ["SCHEDULED"] }, { page: ["1"] },
        ];
        for (const queryParams of cases) {
            const res = response();
            await getInterviewOversight({ query: queryParams }, res);
            assert.equal(res.statusCode, 400, JSON.stringify(queryParams));
        }
        assert.equal(find.mock.callCount(), 0);
    });

    it("returns a safe server error when an oversight query fails", async (t) => {
        t.mock.method(Interview, "find", () => { throw new Error("database unavailable"); });
        const res = response();
        await getInterviewOversight({ query: {} }, res);
        assert.equal(res.statusCode, 500);
        assert.equal(res.body.message, "Interview oversight could not be loaded");
    });
});
