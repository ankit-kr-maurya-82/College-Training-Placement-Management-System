import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import { loginWithGoogle } from "../src/controllers/google-auth.controller.js";
import { Student } from "../src/models/student.model.js";

const clientId = "placement-test-client.apps.googleusercontent.com";
const secret = "google-auth-regression-test-secret";
const credential = "mock-google-id-token";

function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = JSON.parse(JSON.stringify(body));
            return this;
        },
    };
}

function claims(overrides = {}) {
    return {
        sub: "google-subject-123",
        email: "STUDENT@EXAMPLE.COM",
        email_verified: true,
        name: "Google Student",
        iss: "https://accounts.google.com",
        aud: clientId,
        exp: Math.floor(Date.now() / 1000) + 3600,
        ...overrides,
    };
}

function mockGoogleVerification(t, payload) {
    return t.mock.method(OAuth2Client.prototype, "verifyIdToken", async ({ idToken, audience }) => {
        assert.equal(idToken, credential);
        assert.equal(audience, clientId);
        if (payload instanceof Error) throw payload;
        return { getPayload: () => payload };
    });
}

function mockFindOne(t, callback) {
    return t.mock.method(Student, "findOne", callback);
}

describe("Google student authentication", { concurrency: false }, () => {
    let previousClientId;
    let previousSecret;

    beforeEach(() => {
        previousClientId = process.env.GOOGLE_CLIENT_ID;
        previousSecret = process.env.JWT_SECRET;
        process.env.GOOGLE_CLIENT_ID = clientId;
        process.env.JWT_SECRET = secret;
    });

    afterEach(() => {
        if (previousClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
        else process.env.GOOGLE_CLIENT_ID = previousClientId;
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    });

    it("keeps Google IDs sparse and unique and permits a missing password", () => {
        const googleIdIndex = Student.schema.indexes().find(([fields]) => fields.googleId === 1);
        assert.deepEqual(googleIdIndex, [{ googleId: 1 }, { unique: true, sparse: true }]);
        assert.equal(Student.schema.path("password").options.required, undefined);
        assert.equal(Student.schema.path("password").options.select, false);
    });

    it("creates a passwordless student from verified Google claims and returns the normal JWT session", async (t) => {
        mockGoogleVerification(t, claims({ role: "ADMIN" }));
        const lookups = [];
        mockFindOne(t, async (filter) => {
            lookups.push(filter);
            return null;
        });
        const createdStudent = new Student({
            name: "Google Student",
            email: "student@example.com",
            googleId: "google-subject-123",
        });
        const create = t.mock.method(Student, "create", async (data) => {
            assert.deepEqual(data, {
                googleId: "google-subject-123",
                name: "Google Student",
                email: "student@example.com",
            });
            return createdStudent;
        });
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 201);
        assert.equal(create.mock.callCount(), 1);
        assert.deepEqual(lookups, [
            { googleId: "google-subject-123" },
            { email: "student@example.com" },
        ]);
        assert.deepEqual(res.body.student, {
            _id: createdStudent._id.toString(),
            name: "Google Student",
            email: "student@example.com",
        });
        assert.equal(Object.hasOwn(res.body.student, "password"), false);
        const session = jwt.verify(res.body.token, secret);
        assert.equal(session.studentId, createdStudent._id.toString());
        assert.equal(session.email, "student@example.com");
        assert.equal(session.exp - session.iat, 3600);
        assert.equal(session.role, undefined);
    });

    it("signs in an existing Google account without changing its password or role", async (t) => {
        mockGoogleVerification(t, claims({ email: "a-new-google-email@example.com" }));
        const student = new Student({
            name: "Stored Name",
            email: "existing@example.com",
            googleId: "google-subject-123",
            password: "existing-password-hash",
        });
        student.role = "STUDENT";
        mockFindOne(t, async (filter) => filter.googleId ? student : null);
        const create = t.mock.method(Student, "create", async () => {
            throw new Error("Existing accounts must not be recreated");
        });
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.student.email, "existing@example.com");
        assert.equal(student.password, "existing-password-hash");
        assert.equal(student.role, "STUDENT");
        assert.equal(create.mock.callCount(), 0);
    });

    it("rejects a missing credential before calling Google", async (t) => {
        const verify = t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => {
            throw new Error("Verification should not run");
        });
        const res = response();

        await loginWithGoogle({ body: {} }, res);

        assert.equal(res.statusCode, 400);
        assert.deepEqual(res.body, { message: "A valid Google credential is required" });
        assert.equal(verify.mock.callCount(), 0);
    });

    it("rejects invalid credentials returned by the verifier", async (t) => {
        mockGoogleVerification(t, new Error("invalid token"));
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 401);
        assert.deepEqual(res.body, { message: "Google credential could not be verified" });
    });

    it("rejects expired claims even when the mocked verifier returns them", async (t) => {
        mockGoogleVerification(t, claims({ exp: Math.floor(Date.now() / 1000) - 1 }));
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 401);
    });

    it("rejects wrong-audience claims even when the mocked verifier returns them", async (t) => {
        mockGoogleVerification(t, claims({ aud: "different-client.apps.googleusercontent.com" }));
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 401);
    });

    it("rejects unverified email and invalid issuer claims", async (t) => {
        for (const invalidClaims of [
            claims({ email_verified: false }),
            claims({ iss: "https://attacker.example" }),
        ]) {
            mockGoogleVerification(t, invalidClaims);
            const res = response();
            await loginWithGoogle({ body: { credential } }, res);
            assert.equal(res.statusCode, 401);
        }
    });

    it("does not link an existing password account by matching email", async (t) => {
        mockGoogleVerification(t, claims());
        const passwordStudent = new Student({
            name: "Password Account",
            email: "student@example.com",
            password: "preserved-hash",
        });
        mockFindOne(t, async (filter) => filter.googleId ? null : passwordStudent);
        const create = t.mock.method(Student, "create", async () => {
            throw new Error("A conflicting account must not be created");
        });
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 409);
        assert.equal(passwordStudent.password, "preserved-hash");
        assert.equal(create.mock.callCount(), 0);
    });

    it("recovers a duplicate Google ID race by authenticating the row created concurrently", async (t) => {
        mockGoogleVerification(t, claims());
        const concurrentlyCreated = new Student({
            name: "Concurrent Student",
            email: "student@example.com",
            googleId: "google-subject-123",
        });
        let lookupCount = 0;
        mockFindOne(t, async () => {
            lookupCount += 1;
            return lookupCount === 3 ? concurrentlyCreated : null;
        });
        const create = t.mock.method(Student, "create", async () => {
            throw Object.assign(new Error("Duplicate key"), { code: 11000 });
        });
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 200);
        assert.equal(res.body.student._id, concurrentlyCreated._id.toString());
        assert.equal(create.mock.callCount(), 1);
        assert.equal(lookupCount, 3);
    });

    it("rejects an email conflict created concurrently without linking accounts", async (t) => {
        mockGoogleVerification(t, claims());
        const existingStudent = new Student({
            name: "Password Student",
            email: "student@example.com",
            password: "unchanged-hash",
        });
        let lookupCount = 0;
        mockFindOne(t, async () => {
            lookupCount += 1;
            return lookupCount === 4 ? existingStudent : null;
        });
        const create = t.mock.method(Student, "create", async () => {
            throw Object.assign(new Error("Duplicate email"), { code: 11000 });
        });
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 409);
        assert.equal(res.body.message, "An account with this email already exists. Sign in with your existing account.");
        assert.equal(existingStudent.password, "unchanged-hash");
        assert.equal(create.mock.callCount(), 1);
        assert.equal(lookupCount, 4);
    });

    it("rejects a disabled linked student", async (t) => {
        mockGoogleVerification(t, claims());
        const student = new Student({
            name: "Disabled Student",
            email: "student@example.com",
            googleId: "google-subject-123",
            isActive: false,
        });
        mockFindOne(t, async () => student);
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 403);
        assert.deepEqual(res.body, { message: "Student account is disabled" });
    });

    it("fails closed if Google authentication is not configured", async () => {
        delete process.env.GOOGLE_CLIENT_ID;
        const res = response();

        await loginWithGoogle({ body: { credential } }, res);

        assert.equal(res.statusCode, 503);
        assert.deepEqual(res.body, { message: "Google sign-in is not configured" });
    });
});
