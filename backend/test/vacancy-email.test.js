import test from "node:test";
import assert from "node:assert/strict";
import { getApplyUrl, isEligibleStudent, isValidEmail, createVacancyEmail, sendVacancyEmail, setTransportFactory } from "../src/services/vacancy-email.service.js";
import { Drive } from "../src/models/drive.model.js";
import { DriveNotification } from "../src/models/drive-notification.model.js";
import { notifyEligibleStudents } from "../src/controllers/drive-notification.controller.js";

test("eligibility filtering applies CGPA, branch, year, and backlog rules", () => {
    const criteria = { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 };
    assert.equal(isEligibleStudent({ cgpa: 8, department: "cse", graduationYear: 2027, activeBacklogs: 0 }, criteria), true);
    assert.equal(isEligibleStudent({ cgpa: 6, department: "CSE", graduationYear: 2027, activeBacklogs: 0 }, criteria), false);
});

test("recipient validation and application URL use configured frontend", () => {
    process.env.FRONTEND_URL = "https://placements.example/";
    assert.equal(isValidEmail("student@example.edu"), true);
    assert.equal(isValidEmail("bad address"), false);
    assert.equal(getApplyUrl("abc123"), "https://placements.example/drives/abc123");
});

test("vacancy email contains a safe working application link", () => {
    const email = createVacancyEmail({ title: "Engineer", description: "Build products", location: "Pune", ctc: "8 LPA", applicationDeadline: "2027-01-01" }, { name: "Example" }, "https://placements.example/drives/123");
    assert.match(email.html, /href="https:\/\/placements\.example\/drives\/123"/);
    assert.match(email.html, /Apply Now/);
});

test("SMTP failures are surfaced for delivery tracking without real email", async () => {
    Object.assign(process.env, { SMTP_HOST: "smtp.test", SMTP_PORT: "587", SMTP_USER: "user", SMTP_PASS: "secret", SMTP_FROM: "jobs@example.test" });
    setTransportFactory(async () => ({ sendMail: async () => { throw new Error("mock SMTP failure"); } }));
    await assert.rejects(sendVacancyEmail({ to: "student@example.edu", drive: { title: "Engineer" }, company: { name: "Example" }, applyUrl: "https://example.test/drives/1" }), /mock SMTP failure/);
    setTransportFactory(async (options) => (await import("nodemailer")).createTransport(options));
});

test("notification lookup is scoped to the authenticated company", async (t) => {
    t.mock.method(Drive, "findOne", async (filter) => {
        assert.equal(String(filter.company), "507f1f77bcf86cd799439011");
        return null;
    });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await notifyEligibleStudents({ params: { id: "507f1f77bcf86cd799439012" }, user: { companyId: "507f1f77bcf86cd799439011" } }, res);
    assert.equal(res.statusCode, 404);
});

test("delivery tracking enforces one record per vacancy and student", () => {
    const uniquePair = DriveNotification.schema.indexes().find(([fields, options]) => fields.drive === 1 && fields.student === 1 && options.unique);
    assert.ok(uniquePair, "a unique key prevents duplicate sends for the same student and vacancy");
});
