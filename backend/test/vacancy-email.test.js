import test from "node:test";
import assert from "node:assert/strict";
import { getApplyUrl, getEligibilityExclusionReason, isEligibleStudent, isValidEmail, createVacancyEmail, sendVacancyEmail, setTransportFactory } from "../src/services/vacancy-email.service.js";
import { Drive } from "../src/models/drive.model.js";
import { DriveNotification } from "../src/models/drive-notification.model.js";
import { retryFailedNotifications } from "../src/controllers/drive-notification.controller.js";
import { DriveNotificationJob } from "../src/models/drive-notification-job.model.js";

test("eligibility filtering applies CGPA, branch, year, and backlog rules", () => {
    const criteria = { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 };
    assert.equal(isEligibleStudent({ cgpa: 8, department: "cse", graduationYear: 2027, activeBacklogs: 0 }, criteria), true);
    assert.equal(isEligibleStudent({ cgpa: 6, department: "CSE", graduationYear: 2027, activeBacklogs: 0 }, criteria), false);
    assert.equal(isEligibleStudent({}, {}), false);
    assert.equal(getEligibilityExclusionReason({}, {}), "missingEducationData");
    assert.equal(getEligibilityExclusionReason({ activeBacklogs: 2 }, { maxBacklogs: 0 }), "maxBacklogs");
    assert.equal(getEligibilityExclusionReason({ activeBacklogs: 0 }, { maxBacklogs: 0 }), null);
});

test("recipient validation and application URL use configured frontend", () => {
    process.env.FRONTEND_URL = "https://placements.example/";
    assert.equal(isValidEmail("student@example.edu"), true);
    assert.equal(isValidEmail("bad address"), false);
    assert.equal(getApplyUrl("abc123"), "https://placements.example/drives/abc123");
});

test("vacancy email contains a safe working application link", () => {
    const email = createVacancyEmail({ title: "Engineer", description: "Build products", location: "Pune", ctc: "8 LPA", eligibility: { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 }, applicationDeadline: "2027-01-01" }, { name: "Example" }, "https://placements.example/drives/123");
    assert.match(email.html, /href="https:\/\/placements\.example\/drives\/123"/);
    assert.match(email.html, /Apply Now/);
    assert.match(email.html, /Engineer/);
    assert.match(email.html, /Example/);
    assert.match(email.html, /Eligibility/);
    assert.match(email.html, /7/);
    assert.match(email.html, /2027/);
    assert.match(email.html, /Apply by/);
    assert.match(email.text, /Application deadline:/);
    assert.match(email.text, /Apply Now: https:\/\/placements\.example\/drives\/123/);
});

test("SMTP failures are surfaced for delivery tracking without real email", async () => {
    Object.assign(process.env, { SMTP_HOST: "smtp.test", SMTP_PORT: "587", SMTP_USER: "user", SMTP_PASS: "secret", SMTP_FROM: "jobs@example.test" });
    setTransportFactory(async () => ({ sendMail: async () => { throw new Error("mock SMTP failure"); } }));
    await assert.rejects(sendVacancyEmail({ to: "student@example.edu", drive: { title: "Engineer" }, company: { name: "Example" }, applyUrl: "https://example.test/drives/1" }), /mock SMTP failure/);
    setTransportFactory(async (options) => (await import("nodemailer")).createTransport(options));
});

test("Gmail delivery uses secure SMTP and includes a plain text Apply Now link", async () => {
    Object.assign(process.env, { SMTP_HOST: "smtp.gmail.com", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USER: "sender@example.com", SMTP_PASS: "app-password", EMAIL_FROM: "sender@example.com" });
    let transportOptions, message;
    setTransportFactory(async (options) => { transportOptions = options; return { sendMail: async (mail) => { message = mail; } }; });
    await sendVacancyEmail({ to: "student@example.edu", drive: { title: "Engineer", description: "Build products", location: "Pune", ctc: "8 LPA", applicationDeadline: "2027-01-01" }, company: { name: "Example" }, applyUrl: "https://example.test/drives/1" });
    assert.equal(transportOptions.host, "smtp.gmail.com");
    assert.equal(transportOptions.secure, true);
    assert.match(message.text, /Apply Now: https:\/\/example\.test\/drives\/1/);
    setTransportFactory(async (options) => (await import("nodemailer")).createTransport(options));
});

test("retry lookup is scoped to the authenticated company", async (t) => {
    t.mock.method(Drive, "findOne", (filter) => {
        assert.equal(String(filter.company), "507f1f77bcf86cd799439011");
        return { select: () => ({ lean: async () => null }) };
    });
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await retryFailedNotifications({ params: { id: "507f1f77bcf86cd799439012" }, user: { companyId: "507f1f77bcf86cd799439011" } }, res);
    assert.equal(res.statusCode, 404);
});

test("delivery tracking enforces one record per vacancy and student", () => {
    const uniquePair = DriveNotification.schema.indexes().find(([fields, options]) => fields.drive === 1 && fields.student === 1 && options.unique);
    assert.ok(uniquePair, "a unique key prevents duplicate sends for the same student and vacancy");
});

test("failed notifications can be safely retried by the owning company", async (t) => {
    const id = "507f1f77bcf86cd799439011";
    t.mock.method(Drive, "findOne", () => ({ select: () => ({ lean: async () => ({ _id: id, status: "Published", applicationDeadline: new Date("2099-01-01") }) }) }));
    const update = t.mock.method(DriveNotification, "updateMany", async () => ({ modifiedCount: 2 }));
    t.mock.method(DriveNotificationJob, "findOne", () => ({ select: () => ({ lean: async () => ({ status: "DONE" }) }) }));
    const enqueue = t.mock.method(DriveNotificationJob, "updateOne", async () => ({}));
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await retryFailedNotifications({ params: { id }, user: { companyId: id } }, res);
    assert.equal(res.statusCode, 202);
    assert.equal(res.body.retryCount, 2);
    assert.equal(update.mock.calls[0].arguments[0].status, "FAILED");
    assert.equal(enqueue.mock.callCount(), 1);
});
