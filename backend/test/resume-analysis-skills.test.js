import assert from "node:assert/strict";
import test from "node:test";
import { analyzeResumeText } from "../src/services/resume-analysis.service.js";

function skills(text) { return analyzeResumeText(text).technicalSkills; }

test("skill detection covers expanded dictionary", () => {
    const found = skills("Java C++ React MongoDB MySQL Git Docker AWS");
    assert.ok(found.includes("java"));
    assert.ok(found.includes("react"));
    assert.ok(found.includes("mongodb"));
    assert.ok(found.includes("mysql"));
    assert.ok(found.includes("git"));
    assert.ok(found.includes("docker"));
    assert.ok(found.includes("aws"));
});

test("aliases normalize correctly", () => {
    const found = skills("Node JS TS Postgres");
    assert.ok(found.includes("node.js"));
    assert.ok(found.includes("javascript"));
    assert.ok(found.includes("typescript"));
    assert.ok(found.includes("postgresql"));
});

test("duplicates are not returned", () => {
    const found = skills("Java Java java");
    assert.equal(found.filter((s) => s === "java").length, 1);
});

test("Java does not match JavaScript", () => {
    const found = skills("JavaScript");
    assert.ok(!found.includes("java"));
});

test("C++ detection works with punctuation", () => {
    assert.ok(skills("C++").includes("c++"));
    assert.ok(skills("(C++)").includes("c++"));
    assert.ok(skills("C++, Java, Python").includes("c++"));
    assert.ok(skills("Experienced in C++ development.").includes("c++"));
    assert.ok(skills("C++/Python").includes("c++"));
});
test("empty input does not crash", () => {
    const result = analyzeResumeText("");
    assert.ok(Array.isArray(result.technicalSkills));
});
