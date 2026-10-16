import test from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { Student } from "../src/models/student.model.js";
import { Company } from "../src/models/company.model.js";
import { registerStudent, loginStudents } from "../src/controllers/student.controller.js";
import { registerCompany, loginCompany } from "../src/controllers/company.controller.js";
import { resendVerificationEmail, verifyEmail } from "../src/controllers/email-verification.controller.js";
import { requiresEmailVerification, setVerificationEmailSender } from "../src/services/email-verification.service.js";
import { verificationResendRateLimit } from "../src/middlewares/email-verification-rate-limit.middleware.js";

function response() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }
const studentInput = { name: "Student", email: "student@example.test", password: "Password1" };
const companyInput = { companyName: "Company", hrName: "HR", hrEmail: "hr@example.test", hrPassword: "Password1", hrPhoneNumber: "1234567890", location: "City", website: "https://example.test", description: "Hiring" };
let originalFrontend;
test.beforeEach(() => { originalFrontend = process.env.FRONTEND_URL; process.env.FRONTEND_URL = "https://placement.example"; setVerificationEmailSender(async () => {}); });
test.afterEach(() => { if (originalFrontend === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = originalFrontend; setVerificationEmailSender(async () => {}); });

test("student registration stores a token hash and sends a verification link without returning a session", async (t) => {
    const saved = [];
    t.mock.method(Student, "findOne", async () => null);
    t.mock.method(Student.prototype, "save", async function () { saved.push(this); return this; });
    let mail;
    setVerificationEmailSender(async (message) => { mail = message; });
    const res = response();
    await registerStudent({ body: studentInput }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.token, undefined);
    assert.equal(saved[0].isEmailVerified, false);
    assert.match(saved[0].emailVerificationToken, /^[a-f\d]{64}$/);
    assert.match(mail.url, /^https:\/\/placement\.example\/verify-email\?type=student&token=[a-f\d]{64}$/);
    assert.notEqual(saved[0].emailVerificationToken, new URL(mail.url).searchParams.get("token"));
});

test("schema default false does not force legacy records through verification", () => {
    const legacyStudent = new Student({ name: "Legacy", email: "legacy@example.test", password: "hash" });
    assert.equal(legacyStudent.isEmailVerified, false);
    assert.equal(requiresEmailVerification(legacyStudent), false);
    const newPasswordAccount = new Student({ name: "New", email: "new@example.test", password: "hash", isEmailVerified: false });
    assert.equal(requiresEmailVerification(newPasswordAccount), true);
});

test("company registration creates an unverified account and sends verification mail", async (t) => {
    t.mock.method(Company, "findOne", async () => null);
    let input;
    t.mock.method(Company, "create", async (data) => {
        input = data;
        return { toObject: () => ({ ...data, _id: "company-id" }) };
    });
    let mail;
    setVerificationEmailSender(async (message) => { mail = message; });
    const res = response();
    await registerCompany({ body: companyInput }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(input.isEmailVerified, false);
    assert.match(input.emailVerificationToken, /^[a-f\d]{64}$/);
    assert.match(mail.url, /type=company/);
    assert.equal(Object.hasOwn(res.body, "emailVerificationToken"), false);
});

test("valid verification atomically marks only requested account verified and prevents token reuse", async (t) => {
    const token = "c".repeat(64);
    let studentQuery;
    let companyCalls = 0;
    t.mock.method(Student, "findOneAndUpdate", async (query) => { studentQuery = query; return { isEmailVerified: true }; });
    t.mock.method(Company, "findOneAndUpdate", async () => { companyCalls += 1; return null; });
    const res = response();
    await verifyEmail({ params: { accountType: "STUDENT" }, body: { token } }, res);
    assert.equal(res.statusCode, 200);
    assert.notEqual(studentQuery.emailVerificationToken, token);
    assert.ok(studentQuery.emailVerificationExpires.$gt instanceof Date);
    assert.deepEqual(studentQuery.isEmailVerified, { $ne: true });
    const reuse = response();
    await verifyEmail({ params: { accountType: "COMPANY" }, body: { token } }, reuse);
    assert.equal(reuse.statusCode, 400);
    assert.equal(companyCalls, 1);
});

test("invalid and expired verification tokens are rejected", async (t) => {
    let lookup;
    t.mock.method(Student, "findOneAndUpdate", async (filter) => { lookup = filter; return null; });
    const invalid = response();
    await verifyEmail({ params: { accountType: "STUDENT" }, body: { token: "invalid" } }, invalid);
    assert.equal(invalid.statusCode, 400);
    const expired = response();
    await verifyEmail({ params: { accountType: "STUDENT" }, body: { token: "d".repeat(64) } }, expired);
    assert.equal(expired.statusCode, 400);
    assert.ok(lookup.emailVerificationExpires.$gt instanceof Date);
});

test("resend works for unverified accounts, remains generic for unknown and verified addresses, and hides mail failures", async (t) => {
    let mailCount = 0;
    const account = { isEmailVerified: false, async save() {} };
    t.mock.method(Student, "findOne", async ({ email }) => email === "student@example.test" ? account : null);
    setVerificationEmailSender(async () => { mailCount += 1; });
    const valid = response();
    await resendVerificationEmail({ params: { accountType: "STUDENT" }, body: { email: studentInput.email } }, valid);
    assert.equal(valid.statusCode, 200);
    assert.equal(mailCount, 1);
    assert.match(account.emailVerificationToken, /^[a-f\d]{64}$/);
    const missing = response();
    await resendVerificationEmail({ params: { accountType: "STUDENT" }, body: { email: "unknown@example.test" } }, missing);
    assert.deepEqual(missing.body, valid.body);
    account.isEmailVerified = true;
    const verified = response();
    await resendVerificationEmail({ params: { accountType: "STUDENT" }, body: { email: studentInput.email } }, verified);
    assert.deepEqual(verified.body, valid.body);
    assert.equal(mailCount, 1);
    account.isEmailVerified = false;
    setVerificationEmailSender(async () => { throw new Error("SMTP credentials must not leak"); });
    const failure = response();
    await resendVerificationEmail({ params: { accountType: "STUDENT" }, body: { email: studentInput.email } }, failure);
    assert.deepEqual(failure.body, valid.body);
    assert.equal(JSON.stringify(failure.body).includes("SMTP"), false);
    let companyFilter;
    t.mock.method(Company, "findOne", async (filter) => { companyFilter = filter; return null; });
    const companyResult = response();
    await resendVerificationEmail({ params: { accountType: "COMPANY" }, body: { email: companyInput.hrEmail } }, companyResult);
    assert.deepEqual(companyFilter, { hrEmail: companyInput.hrEmail });
    assert.deepEqual(companyResult.body, valid.body);
});

test("verification resend requests are rate limited", () => {
    let nextCount = 0;
    const req = { ip: "verification-rate-limit-test", baseUrl: "/api/v1/students" };
    const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    for (let i = 0; i < 5; i += 1) verificationResendRateLimit(req, res, () => { nextCount += 1; });
    verificationResendRateLimit(req, res, () => { nextCount += 1; });
    assert.equal(nextCount, 5);
    assert.equal(res.statusCode, 429);
});

test("unverified password logins are blocked while verified and Google accounts remain compatible", async (t) => {
    process.env.JWT_SECRET = "email-verification-test-secret";
    const password = await bcrypt.hash("Password1", 4);
    const student = { _id: "student-id", name: "Student", email: studentInput.email, password, isEmailVerified: false };
    t.mock.method(Student, "findOne", () => ({ select() { return Promise.resolve(student); } }));
    const studentRes = response();
    await loginStudents({ body: { email: student.email, password: "Password1" } }, studentRes);
    assert.equal(studentRes.statusCode, 403);
    assert.match(studentRes.body.message, /verify your email/i);
    student.isEmailVerified = true;
    const verifiedRes = response();
    await loginStudents({ body: { email: student.email, password: "Password1" } }, verifiedRes);
    assert.equal(verifiedRes.statusCode, 200);
    const googleStudent = new Student({ googleId: "google-sub", name: "Google", email: "google@example.test", isEmailVerified: true });
    assert.equal(googleStudent.isEmailVerified, true);

    const company = { _id: "company-id", companyName: "Company", hrEmail: companyInput.hrEmail, hrPassword: password, isEmailVerified: false, toObject() { return { _id: this._id, companyName: this.companyName, hrEmail: this.hrEmail }; } };
    t.mock.method(Company, "findOne", async () => company);
    const companyRes = response();
    await loginCompany({ body: { companyName: "Company", hrEmail: company.hrEmail, hrPassword: "Password1" } }, companyRes);
    assert.equal(companyRes.statusCode, 403);
    company.isEmailVerified = true;
    const companyVerified = response();
    await loginCompany({ body: { companyName: "Company", hrEmail: company.hrEmail, hrPassword: "Password1" } }, companyVerified);
    assert.equal(companyVerified.statusCode, 200);
});
