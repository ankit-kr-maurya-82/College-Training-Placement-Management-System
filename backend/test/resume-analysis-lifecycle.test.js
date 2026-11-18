import assert from "node:assert/strict";
import test from "node:test";
import { analyzeResumeText } from "../src/services/resume-analysis.service.js";

test("analysis result preserves score bounds and recommendations", () => {
    const result = analyzeResumeText("Education in computer science. Built projects with Java and SQL. Internship experience. Certified in cloud. Awarded hackathon.");
    assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
    assert.ok(Array.isArray(result.suggestions));
    assert.ok(result.technicalSkills.length >= 0);
});
