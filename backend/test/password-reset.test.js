import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { Student } from "../src/models/student.model.js";
import { Company } from "../src/models/company.model.js";
import { requestPasswordReset, resetPassword } from "../src/controllers/password-reset.controller.js";
import { setPasswordResetEmailSender } from "../src/services/password-reset.service.js";

function response() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
const originalFrontend = process.env.FRONTEND_URL;
test.beforeEach(() => { process.env.FRONTEND_URL = "https://placement.example"; setPasswordResetEmailSender(async () => {}); });
test.after(() => { if (originalFrontend === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = originalFrontend; setPasswordResetEmailSender(async () => {}); });

test("forgot password uses correct model/email field and emails a token without returning it", async (t) => {
    const account = { resetPasswordToken: null, resetPasswordExpires: null, async save() {} };
    let filter;
    t.mock.method(Student, "findOne", async (query) => { filter = query; return account; });
    t.mock.method(Company, "findOne", async () => { throw new Error("wrong account model"); });
    let email;
    setPasswordResetEmailSender(async (data) => { email = data; });
    const res = response();
    await requestPasswordReset({ params: { accountType: "STUDENT" }, body: { email: " STUDENT@example.com " } }, res);
    assert.equal(res.statusCode, 200);
    assert.deepEqual(filter, { email: "student@example.com" });
    assert.match(email.url, /^https:\/\/placement\.example\/reset-password\?type=student&token=[a-f0-9]{64}$/);
    assert.equal(account.resetPasswordToken.length, 64);
    assert.equal(res.body.message.includes(new URL(email.url).searchParams.get("token")), false);
});

test("unknown email and email-service failure return the same generic response", async (t) => {
    t.mock.method(Student, "findOne", async () => null);
    const unknown = response();
    await requestPasswordReset({ params: { accountType: "STUDENT" }, body: { email: "missing@example.com" } }, unknown);
    const account = { async save() {} };
    t.mock.method(Company, "findOne", async () => account);
    setPasswordResetEmailSender(async () => { throw new Error("private SMTP detail"); });
    const failed = response();
    await requestPasswordReset({ params: { accountType: "COMPANY" }, body: { email: "hr@example.com" } }, failed);
    assert.equal(unknown.statusCode, failed.statusCode);
    assert.deepEqual(unknown.body, failed.body);
    assert.equal(JSON.stringify(failed.body).includes("SMTP"), false);
});

test("company recovery resolves only company HR email", async (t) => {
    let companyFilter;
    t.mock.method(Company, "findOne", async (query) => { companyFilter = query; return null; });
    const res = response();
    await requestPasswordReset({ params: { accountType: "COMPANY" }, body: { email: "hr@example.com" } }, res);
    assert.deepEqual(companyFilter, { hrEmail: "hr@example.com" });
    assert.equal(res.statusCode, 200);
});

test("reset rejects invalid, expired, and reused tokens and validates password requirements", async (t) => {
    let called = 0;
    t.mock.method(Student, "findOneAndUpdate", async () => { called += 1; return null; });
    for (const [payload, expected] of [
        [{ token: "bad", password: "StrongPass1", confirmPassword: "StrongPass1" }, 400],
        [{ token: "a".repeat(64), password: "weak", confirmPassword: "weak" }, 400],
        [{ token: "a".repeat(64), password: "StrongPass1", confirmPassword: "Different1" }, 400],
        [{ token: "a".repeat(64), password: "StrongPass1", confirmPassword: "StrongPass1" }, 400],
    ]) {
        const res = response();
        await resetPassword({ params: { accountType: "STUDENT" }, body: payload }, res);
        assert.equal(res.statusCode, expected);
    }
    assert.equal(called, 1); // expired and consumed tokens are rejected by the same atomic lookup
});

test("valid company reset hashes password and consumes the hashed token", async (t) => {
    let filter;
    let update;
    t.mock.method(Company, "findOneAndUpdate", async (query, changes) => { filter = query; update = changes; return { _id: "company" }; });
    const res = response();
    await resetPassword({ params: { accountType: "COMPANY" }, body: { token: "b".repeat(64), password: "StrongPass1", confirmPassword: "StrongPass1" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(filter.resetPasswordToken.length, 64);
    assert.notEqual(filter.resetPasswordToken, "b".repeat(64));
    assert.ok(filter.resetPasswordExpires.$gt instanceof Date);
    assert.equal(await bcrypt.compare("StrongPass1", update.$set.hrPassword), true);
    assert.deepEqual(update.$unset, { resetPasswordToken: 1, resetPasswordExpires: 1 });
});
