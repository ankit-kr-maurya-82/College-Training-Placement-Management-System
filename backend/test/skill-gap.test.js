import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Company } from "../src/models/company.model.js";
import { Drive } from "../src/models/drive.model.js";
import { Student } from "../src/models/student.model.js";
import { getSkillGaps } from "../src/controllers/skill-gap.controller.js";

function response() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function query(value) {
    const result = { select: () => result, lean: async () => value };
    return result;
}

describe("skill gaps endpoint", { concurrency: false }, () => {
    it("returns aggregated skill gap data with defaults", async (t) => {
        const companyId = "507f1f77bcf86cd799439012";
        let companyFilter;
        t.mock.method(Company, "find", (filter) => { companyFilter = filter; return query([{ _id: companyId }]); });
        const activeStudentCount = 5;
        t.mock.method(Student, "countDocuments", async (filter) => { assert.deepEqual(filter, { isActive: { $ne: false } }); return activeStudentCount; });
        // supply groups: 2 students with React, 1 with Go
        t.mock.method(Student, "aggregate", async () => [
            { _id: "react", studentCount: 2, skill: "React" },
            { _id: "go", studentCount: 1, skill: "Go" }
        ]);
        // demand groups: React required by 3 drives, Go by 1 drive, Node.js by 2 drives
        t.mock.method(Drive, "aggregate", async () => [
            { _id: "react", skill: "React", driveCount: 3 },
            { _id: "go", skill: "Go", driveCount: 1 },
            { _id: "node.js", skill: "Node.js", driveCount: 2 }
        ]);
        const res = response();
        await getSkillGaps({}, res);
        assert.equal(res.statusCode, 200);
        const { skillGaps, note, filters } = res.body;
        assert.deepEqual(filters, { minDrives: 0, minStudents: 0, limit: 10 });
        // default limit 10, should include top 3 sorted by driveCount desc then missingSkill desc then skill asc
        assert.deepEqual(skillGaps, [
            { skill: "React", driveCount: 3, studentsWithSkill: 2, activeStudentsMissingSkill: 3 },
            { skill: "Node.js", driveCount: 2, studentsWithSkill: 0, activeStudentsMissingSkill: 5 },
            { skill: "Go", driveCount: 1, studentsWithSkill: 1, activeStudentsMissingSkill: 4 }
        ]);
        assert.match(note, /Counts use active student profiles/);
    });

    it("applies case‑insensitive search filter", async (t) => {
        t.mock.method(Company, "find", () => query([]));
        t.mock.method(Student, "countDocuments", async () => 0);
        t.mock.method(Student, "aggregate", async () => []);
        t.mock.method(Drive, "aggregate", async () => [
            { _id: "react", skill: "React", driveCount: 3 },
            { _id: "go", skill: "Go", driveCount: 1 }
        ]);
        const res = response();
        await getSkillGaps({ query: { search: "reAc" } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.skillGaps.length, 1);
        assert.equal(res.body.skillGaps[0].skill, "React");
    });

    it("honors minDrives and minStudents filters", async (t) => {
        t.mock.method(Company, "find", () => query([]));
        t.mock.method(Student, "countDocuments", async () => 0);
        t.mock.method(Student, "aggregate", async () => [
            { _id: "react", studentCount: 5, skill: "React" },
            { _id: "go", studentCount: 1, skill: "Go" }
        ]);
        t.mock.method(Drive, "aggregate", async () => [
            { _id: "react", skill: "React", driveCount: 4 },
            { _id: "go", skill: "Go", driveCount: 2 }
        ]);
        const res = response();
        await getSkillGaps({ query: { minDrives: "3", minStudents: "5" } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.skillGaps, [
            { skill: "React", driveCount: 4, studentsWithSkill: 5, activeStudentsMissingSkill: 0 }
        ]);
    });

    it("rejects invalid numeric parameters", async (t) => {
        const res = response();
        await getSkillGaps({ query: { minDrives: "-1" } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.message, "minDrives must be a non‑negative integer");
    });
});

