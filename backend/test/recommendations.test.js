import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Application } from "../src/models/application.model.js";
import { Company } from "../src/models/company.model.js";
import { Drive } from "../src/models/drive.model.js";
import { getMyRecommendations } from "../src/controllers/recommendation.controller.js";
import { rankRecommendations, scoreDriveRecommendation } from "../src/services/job-recommendation.service.js";

const studentId = "507f1f77bcf86cd799439011";
const companyId = "507f1f77bcf86cd799439012";
const driveId = "507f1f77bcf86cd799439013";

function response() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function query(value) {
    const result = {
        select: () => result,
        populate: () => result,
        lean: async () => value,
    };
    return result;
}

function drive(overrides = {}) {
    return {
        _id: driveId,
        title: "Backend Engineer",
        status: "Published",
        applicationDeadline: new Date("2099-12-31T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        eligibility: { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 },
        requiredSkills: ["Node.js", "React"],
        company: { _id: companyId, name: "Example Ltd" },
        ...overrides,
    };
}

describe("job recommendations", { concurrency: false }, () => {
    it("ranks deterministic weighted matches and exposes matched and missing requirements", () => {
        const result = scoreDriveRecommendation({ cgpa: 8, department: "cse", graduationYear: 2027, activeBacklogs: 0, skills: ["node.js"] }, drive());
        assert.equal(result.matchScore, 80);
        assert.equal(result.eligibilityStatus, "ELIGIBLE");
        assert.deepEqual(result.matchedRequirements, ["Branch: cse", "Minimum CGPA: 7", "Graduation year: 2027", "Active backlogs: 0 (maximum 0)", "Skill: Node.js"]);
        assert.deepEqual(result.missingRequirements, ["Skill: React"]);
        const ranked = rankRecommendations([{ matchScore: 60, drive: drive() }, { matchScore: 80, drive: drive({ _id: "other", applicationDeadline: new Date("2099-12-30"), createdAt: new Date("2025-01-01") }) }]);
        assert.equal(ranked[0].matchScore, 80);
        assert.equal(rankRecommendations(ranked, "deadline")[0].drive._id, "other");
        assert.equal(rankRecommendations(ranked, "newest")[0].drive._id, driveId);
        const tied = [{ matchScore: 80, drive: drive({ _id: "z-drive" }) }, { matchScore: 80, drive: drive({ _id: "a-drive" }) }];
        assert.deepEqual(rankRecommendations(tied).map((item) => item.drive._id), ["a-drive", "z-drive"]);
    });

    it("does not mark missing required profile data as eligible", () => {
        const result = scoreDriveRecommendation({ skills: ["Node.js"] }, drive());
        assert.equal(result.eligibilityStatus, "INCOMPLETE");
        assert.ok(result.missingRequirements.some((item) => item.includes("add your CGPA")));
        assert.ok(result.missingRequirements.some((item) => item.includes("department or course")));
        const failing = scoreDriveRecommendation({ cgpa: 5, department: "ECE", graduationYear: 2027, activeBacklogs: 0 }, drive());
        assert.equal(failing.eligibilityStatus, "NOT_ELIGIBLE");
    });

    it("returns no fabricated score when a drive has no supported match criteria", () => {
        const result = scoreDriveRecommendation({}, drive({ eligibility: {}, requiredSkills: [] }));
        assert.equal(result.matchScore, null);
        assert.equal(result.eligibilityStatus, "ELIGIBLE");
    });

    it("requires a student identity and ignores client-supplied student IDs", async (t) => {
        const companyFind = t.mock.method(Company, "find", () => query([{ _id: companyId }]));
        const driveFind = t.mock.method(Drive, "find", () => query([drive()]));
        let applicationFilter;
        const applicationFind = t.mock.method(Application, "find", (filter) => { applicationFilter = filter; return query([]); });
        const denied = response();
        await getMyRecommendations({ user: {}, query: {} }, denied);
        assert.equal(denied.statusCode, 403);
        assert.equal(driveFind.mock.callCount(), 0);

        const res = response();
        await getMyRecommendations({
            user: { studentId },
            studentAccount: { cgpa: 8, department: "CSE", graduationYear: 2027, activeBacklogs: 0, skills: [] },
            query: { studentId: "507f1f77bcf86cd799439099", limit: "10" },
        }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(applicationFilter, { student: studentId });
        assert.deepEqual(res.body.recommendations.map(({ drive: item }) => item._id), [driveId]);
        assert.equal(companyFind.mock.callCount(), 1);
        assert.equal(applicationFind.mock.callCount(), 1);
    });

    it("queries only published, unexpired drives from active companies", async (t) => {
        t.mock.method(Company, "find", (filter) => {
            assert.deepEqual(filter, { isActive: true });
            return query([]);
        });
        let filter;
        t.mock.method(Drive, "find", (value) => { filter = value; return query([]); });
        t.mock.method(Application, "find", () => query([]));
        const res = response();
        await getMyRecommendations({ user: { studentId }, studentAccount: {}, query: {} }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(filter.status, "Published");
        assert.ok(filter.applicationDeadline.$gt instanceof Date);
        assert.deepEqual(filter.company.$in, []);
    });

    it("filters by eligibility, job fields, and search, then paginates ranked results", async (t) => {
        t.mock.method(Company, "find", () => query([{ _id: companyId, name: "Example Ltd" }]));
        let filter;
        t.mock.method(Drive, "find", (value) => { filter = value; return query([drive(), drive({ _id: "507f1f77bcf86cd799439019", title: "Platform Engineer", eligibility: { minCGPA: 7 } })]); });
        t.mock.method(Application, "find", () => query([]));
        const res = response();
        await getMyRecommendations({
            user: { studentId },
            studentAccount: { cgpa: 8, department: "CSE", graduationYear: 2027, activeBacklogs: 0, skills: ["Node.js", "React"] },
            query: { eligibility: "ELIGIBLE", jobType: "Full-time", workMode: "Hybrid", search: "Example", sort: "deadline", page: "1", limit: "1" },
        }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(filter.status, "Published");
        assert.equal(filter.jobType, "Full-time");
        assert.equal(filter.workMode, "Hybrid");
        assert.ok(filter.$or.slice(0, 4).every((clause) => Object.values(clause)[0] instanceof RegExp));
        assert.deepEqual(filter.$or[4].company.$in, [companyId]);
        assert.equal(res.body.pagination.total, 2);
        assert.equal(res.body.recommendations.length, 1);
        assert.equal(res.body.recommendations[0].matchScore, 100);
    });
});
