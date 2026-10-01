import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { afterEach, beforeEach, describe, it } from "node:test";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { loginStudents, registerStudent } from "../src/controllers/student.controller.js";
import { Student } from "../src/models/student.model.js";

const credentials = {
    name: "  Example Student  ",
    email: "  STUDENT@EXAMPLE.COM  ",
    password: "  secret-password  ",
};
const testSecret = "student-auth-regression-test-secret";

function response() {
    return {
        statusCode: 200,
        statuses: [],
        jsonCalls: 0,
        body: undefined,
        status(code) {
            this.statusCode = code;
            this.statuses.push(code);
            return this;
        },
        json(body) {
            this.jsonCalls += 1;
            assert.equal(this.jsonCalls, 1, "A request must send exactly one response");
            this.body = JSON.parse(JSON.stringify(body));
            return this;
        },
    };
}

function stubDatabase(t, overrides = {}) {
    return {
        findOne: t.mock.method(Student, "findOne", overrides.findOne ?? (async () => null)),
        create: t.mock.method(Student, "create", async () => {
            throw new Error("Registration must not persist through Student.create");
        }),
        save: t.mock.method(Student.prototype, "save", overrides.save ?? (async () => {
            throw new Error("Unexpected student save");
        })),
    };
}

function assertNoWrites(models) {
    assert.equal(models.create.mock.callCount(), 0);
    assert.equal(models.save.mock.callCount(), 0);
}

describe("student registration and login", { concurrency: false }, () => {
    let originalSecret;

    beforeEach(() => {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = testSecret;
    });

    afterEach(() => {
        if (originalSecret === undefined) {
            delete process.env.JWT_SECRET;
        } else {
            process.env.JWT_SECRET = originalSecret;
        }
    });

    it("saves a hashed password once, responds after saving, and supports subsequent login", async (t) => {
        let savedStudent;
        const registration = response();
        const models = stubDatabase(t, {
            findOne: async () => savedStudent ?? null,
            save: async function () {
                await setImmediate();
                assert.equal(registration.jsonCalls, 0, "Registration must await persistence");
                savedStudent = this;
                return this;
            },
        });

        await registerStudent({ body: credentials }, registration);

        assert.equal(registration.statusCode, 201);
        assert.equal(registration.jsonCalls, 1);
        assert.equal(models.findOne.mock.callCount(), 1);
        assert.deepEqual(models.findOne.mock.calls[0].arguments, [{ email: "student@example.com" }]);
        assert.equal(models.create.mock.callCount(), 0);
        assert.equal(models.save.mock.callCount(), 1);
        assert.equal(bcrypt.getRounds(savedStudent.password), 10);
        assert.equal(await bcrypt.compare(credentials.password.trim(), savedStudent.password), true);
        assert.deepEqual(registration.body, {
            message: "Student registered successfully",
            student: {
                _id: savedStudent._id.toString(),
                name: "Example Student",
                email: "student@example.com",
            },
            token: registration.body.token,
        });
        const token = jwt.verify(registration.body.token, testSecret);
        assert.equal(token.studentId, savedStudent._id.toString());
        assert.equal(token.email, "student@example.com");
        assert.equal(token.exp - token.iat, 3600);
        assert.equal(JSON.stringify(registration.body).includes(credentials.password.trim()), false);
        assert.equal(JSON.stringify(registration.body).includes(savedStudent.password), false);

        for (const [password, expectedStatus] of [
            [credentials.password, 200],
            ["incorrect-password", 401],
            [savedStudent.password, 401],
        ]) {
            const login = response();
            await loginStudents({ body: { email: credentials.email, password } }, login);
            assert.equal(login.statusCode, expectedStatus);
            assert.equal(login.jsonCalls, 1);
            if (expectedStatus === 200) {
                assert.deepEqual(login.body, {
                    message: "Student logged in successfully",
                    student: registration.body.student,
                });
            }
        }
        assert.equal(models.save.mock.callCount(), 1, "Login must not persist another student");
        assert.equal(models.create.mock.callCount(), 0);
    });

    it("rejects missing or invalid required fields before using the database", async (t) => {
        const models = stubDatabase(t);
        const cases = [
            [undefined, "Name is required"],
            [{ ...credentials, name: " \t " }, "Name is required"],
            [{ ...credentials, email: 42 }, "Email is required"],
            [{ ...credentials, password: "  " }, "Password is required"],
        ];
        for (const [body, message] of cases) {
            const res = response();
            await registerStudent({ body }, res);
            assert.equal(res.statusCode, 400);
            assert.equal(res.jsonCalls, 1);
            assert.deepEqual(res.body, { message });
        }
        assert.equal(models.findOne.mock.callCount(), 0);
        assertNoWrites(models);
    });

    it("rejects a duplicate normalized email without persisting", async (t) => {
        const models = stubDatabase(t, { findOne: async () => ({ _id: "existing-student" }) });
        const res = response();

        await registerStudent({ body: credentials }, res);

        assert.equal(res.statusCode, 400);
        assert.equal(res.jsonCalls, 1);
        assert.deepEqual(res.body, { message: "Email already exists" });
        assert.deepEqual(models.findOne.mock.calls[0].arguments, [{ email: "student@example.com" }]);
        assertNoWrites(models);
    });

    it("returns one error without saving if JWT signing fails", async (t) => {
        delete process.env.JWT_SECRET;
        const models = stubDatabase(t);
        t.mock.method(console, "error", () => {});
        const res = response();

        await registerStudent({ body: credentials }, res);

        assert.deepEqual(res.statuses, [500]);
        assert.equal(res.jsonCalls, 1);
        assert.equal(res.body.message, "Error registering student");
        assertNoWrites(models);
    });

    it("returns one error and never sends success when saving fails", async (t) => {
        const models = stubDatabase(t, {
            save: async () => {
                await setImmediate();
                throw new Error("Database unavailable");
            },
        });
        t.mock.method(console, "error", () => {});
        const res = response();

        await registerStudent({ body: credentials }, res);

        assert.deepEqual(res.statuses, [500]);
        assert.equal(res.jsonCalls, 1);
        assert.equal(res.body.message, "Error registering student");
        assert.equal(models.create.mock.callCount(), 0);
        assert.equal(models.save.mock.callCount(), 1);
    });

    it("returns one error without saving when the email lookup fails", async (t) => {
        const models = stubDatabase(t, {
            findOne: async () => { throw new Error("Database unavailable"); },
        });
        t.mock.method(console, "error", () => {});
        const res = response();

        await registerStudent({ body: credentials }, res);

        assert.deepEqual(res.statuses, [500]);
        assert.equal(res.jsonCalls, 1);
        assertNoWrites(models);
    });

    it("preserves trimmed password login for legacy plaintext accounts", async (t) => {
        const student = new Student({
            name: "Legacy Student",
            email: "student@example.com",
            password: credentials.password.trim(),
        });
        const models = stubDatabase(t, { findOne: async () => student });

        for (const [password, expectedStatus] of [
            [credentials.password, 200],
            ["incorrect-password", 401],
        ]) {
            const res = response();
            await loginStudents({ body: { email: credentials.email, password } }, res);
            assert.equal(res.statusCode, expectedStatus);
            assert.equal(res.jsonCalls, 1);
            if (expectedStatus === 200) {
                assert.equal(res.body.student._id, student._id.toString());
                assert.equal(Object.hasOwn(res.body.student, "password"), false);
            }
        }
        assert.deepEqual(models.findOne.mock.calls[0].arguments, [{ email: "student@example.com" }]);
        assertNoWrites(models);
    });
});
