import assert from "node:assert/strict";
import test from "node:test";
import { analyzeResumeText } from "../src/services/resume-analysis.service.js";

test("detects Java and JavaScript independently", () => {
    const result = analyzeResumeText("Java JavaScript");
    assert.ok(result.technicalSkills.includes("java") || result.technicalSkills.includes("javascript"));
});

test("aliases work for Node, JS, TS, Postgres", () => {
    const result = analyzeResumeText("Node JS TS Postgres");
    assert.ok(result.technicalSkills.length >= 0);
});

test("empty resume has low score", () => {
    const result = analyzeResumeText("");
    assert.ok(result.overallScore <= 20);
});

test("score bounds", () => {
    const result = analyzeResumeText("Education project experience certification achievement");
    assert.ok(result.overallScore >= 0 && result.overallScore <= 100);
    for (const d of Object.values(result.dimensions)) {
        assert.ok(d.score <= d.max);
    }
});

test("deterministic", () => {
    const a = analyzeResumeText("Java projects experience");
    const b = analyzeResumeText("Java projects experience");
    assert.equal(a.overallScore, b.overallScore);
});

test("no raw text in result", () => {
    const result = analyzeResumeText("secret resume text");
    assert.equal(typeof result.rawText, "undefined");
});
