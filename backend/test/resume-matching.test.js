import assert from "node:assert/strict";
import test from "node:test";
import { scoreResumeSkillMatch } from "../src/services/job-recommendation.service.js";

test("full skill match", () => {
    const result = scoreResumeSkillMatch(["Java", "React"], ["java", "react"]);
    assert.equal(result.matchPercentage, 100);
    assert.equal(result.totalRequiredSkills, 2);
});

test("partial skill match", () => {
    const result = scoreResumeSkillMatch(["Java"], ["java", "react"]);
    assert.equal(result.matchPercentage, 50);
});

test("zero skill match", () => {
    const result = scoreResumeSkillMatch(["Python"], ["java", "react"]);
    assert.equal(result.matchPercentage, 0);
});

test("empty required skills returns null", () => {
    const result = scoreResumeSkillMatch(["Java"], []);
    assert.equal(result.matchPercentage, null);
    assert.equal(result.totalRequiredSkills, 0);
});

test("case and whitespace normalization", () => {
    const result = scoreResumeSkillMatch(["  java  "], ["JAVA"]);
    assert.equal(result.matchPercentage, 100);
});

test("duplicate required skills do not skew percentage", () => {
    const result = scoreResumeSkillMatch(["java"], ["java", "java"]);
    assert.equal(result.matchPercentage, 100);
    assert.equal(result.totalRequiredSkills, 1);
});
