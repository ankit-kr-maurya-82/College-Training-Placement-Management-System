import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Company } from "../src/models/company.model.js";
import { Drive } from "../src/models/drive.model.js";
import { Student } from "../src/models/student.model.js";
import { getMySkillReadiness, getSkillReadinessAnalytics } from "../src/controllers/skill-readiness.controller.js";
import { buildStudentSkillReadiness, mergeSkillSupplyAndDemand } from "../src/services/skill-readiness.service.js";

const studentId = "507f1f77bcf86cd799439011";
const companyId = "507f1f77bcf86cd799439012";

function response() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function query(value) {
    const result = { select: () => result, lean: async () => value };
    return result;
}

describe("placement skill readiness", { concurrency: false }, () => {
    it("compares distinct exact skill labels case-insensitively and counts drive-skill demand", () => {
        const readiness = buildStudentSkillReadiness([" React ", "react", "SQL"], [
            { requiredSkills: ["React", "Node.js", "node.js"] },
            { requiredSkills: ["NODE.JS", "SQL"] },
            { requiredSkills: [] },
        ]);
        assert.equal(readiness.profileSkillCount, 2);
        assert.equal(readiness.activeDriveCount, 3);
        assert.equal(readiness.drivesWithSkillRequirements, 2);
        assert.equal(readiness.matchedDemandOccurrences, 2);
        assert.equal(readiness.totalDemandOccurrences, 4);
        assert.equal(readiness.skillCoveragePercentage, 50);
        assert.deepEqual(readiness.missingSkills, [{ skill: "Node.js", driveCount: 2 }]);
        assert.match(readiness.note, /does not measure proficiency/);
    });

    it("handles empty demand without fabricating a readiness score", () => {
        const readiness = buildStudentSkillReadiness([], []);
        assert.equal(readiness.skillCoveragePercentage, null);
        assert.deepEqual(readiness.missingSkills, []);
    });

    it("merges privacy-safe aggregate demand and supply counts", () => {
        assert.deepEqual(mergeSkillSupplyAndDemand(
            [{ _id: "react", skill: "React", driveCount: 3 }, { _id: "go", skill: "Go", driveCount: 1 }],
            [{ _id: "react", studentCount: 4 }],
            10,
        ), [
            { skill: "React", driveCount: 3, studentsWithSkill: 4, activeStudentsMissingSkill: 6 },
            { skill: "Go", driveCount: 1, studentsWithSkill: 0, activeStudentsMissingSkill: 10 },
        ]);
    });

    it("uses only the authenticated student's middleware profile and open drives", async (t) => {
        let companyFilter;
        let driveFilter;
        t.mock.method(Company, "find", (filter) => { companyFilter = filter; return query([{ _id: companyId }]); });
        t.mock.method(Drive, "find", (filter) => { driveFilter = filter; return query([{ requiredSkills: ["React", "Node.js"] }]); });
        const denied = response();
        await getMySkillReadiness({ user: { studentId }, query: { studentId: "507f1f77bcf86cd799439099" } }, denied);
        assert.equal(denied.statusCode, 404);
        const res = response();
        await getMySkillReadiness({ user: { studentId }, studentAccount: { _id: studentId, skills: ["react"] } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(companyFilter, { isActive: true });
        assert.equal(driveFilter.status, "Published");
        assert.deepEqual(driveFilter.company.$in, [companyId]);
        assert.deepEqual(res.body.readiness.missingSkills, [{ skill: "Node.js", driveCount: 1 }]);
    });

    it("returns aggregate counts only and filters out inactive accounts and expired drives", async (t) => {
        let studentPipeline;
        let demandPipeline;
        t.mock.method(Company, "find", () => query([{ _id: companyId }]));
        t.mock.method(Student, "countDocuments", async (filter) => { assert.deepEqual(filter, { isActive: { $ne: false } }); return 10; });
        t.mock.method(Student, "aggregate", async (pipeline) => { studentPipeline = pipeline; return [{ _id: "react", skill: "React", studentCount: 4 }]; });
        t.mock.method(Drive, "aggregate", async (pipeline) => { demandPipeline = pipeline; return [{ _id: "react", skill: "React", driveCount: 3 }]; });
        t.mock.method(Drive, "countDocuments", async (filter) => { assert.equal(filter.status, "Published"); assert.ok(filter.applicationDeadline.$gt instanceof Date); return 5; });
        const res = response();
        await getSkillReadinessAnalytics({}, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.activeStudentCount, 10);
        assert.equal(res.body.activeDriveCount, 5);
        assert.deepEqual(res.body.skills, [{ skill: "React", driveCount: 3, studentsWithSkill: 4, activeStudentsMissingSkill: 6 }]);
        assert.deepEqual(studentPipeline[0], { $match: { isActive: { $ne: false } } });
        assert.equal(demandPipeline[0].$match.status, "Published");
        assert.ok(!JSON.stringify(res.body).includes(studentId));
    });

    it("returns empty aggregate arrays when no demand or students exist", async (t) => {
        t.mock.method(Company, "find", () => query([]));
        t.mock.method(Student, "countDocuments", async () => 0);
        t.mock.method(Student, "aggregate", async () => []);
        t.mock.method(Drive, "aggregate", async () => []);
        t.mock.method(Drive, "countDocuments", async () => 0);
        const res = response();
        await getSkillReadinessAnalytics({}, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.skills, []);
    });
});
