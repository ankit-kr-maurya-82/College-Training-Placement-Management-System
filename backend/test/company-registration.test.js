import assert from "node:assert/strict";
import { once } from "node:events";
import { setImmediate } from "node:timers/promises";
import { after, before, describe, it } from "node:test";
import { app } from "../src/app.js";
import { Company } from "../src/models/company.model.js";

const validCompany = {
    companyName: "  Example Company  ",
    hrName: "  Example HR  ",
    hrEmail: "  HR@EXAMPLE.COM  ",
    hrPassword: "  secret-password  ",
    hrPhoneNumber: "  9876543210  ",
    location: "  Lucknow  ",
    website: "  https://example.com  ",
    description: "  Software company  ",
};

const requiredFields = {
    companyName: "Company name is required",
    hrName: "HR name is required",
    hrEmail: "HR email is required",
    hrPassword: "HR password is required",
    hrPhoneNumber: "HR phone number is required",
    location: "Location is required",
    website: "Website is required",
    description: "Description is required",
};

// Import the Express app without src/index.js so tests never connect to MongoDB.
// Every test replaces model operations before making a request.
describe("POST /api/v1/companies/register", { concurrency: false }, () => {
    let server;
    let registerUrl;

    before(async () => {
        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        registerUrl = `http://127.0.0.1:${server.address().port}/api/v1/companies/register`;
    });

    after(async () => {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
                server.closeAllConnections();
            });
        }
    });

    async function register(body, encoding = "json") {
        const options = { method: "POST", signal: AbortSignal.timeout(2000) };
        if (body !== undefined) {
            options.headers = {
                "Content-Type": encoding === "form"
                    ? "application/x-www-form-urlencoded"
                    : "application/json",
            };
            options.body = encoding === "form"
                ? new URLSearchParams(body).toString()
                : JSON.stringify(body);
        }
        const response = await fetch(registerUrl, options);
        return { status: response.status, body: await response.json() };
    }

    function stubDatabase(t, overrides = {}) {
        return {
            findOne: t.mock.method(Company, "findOne", overrides.findOne ?? (async () => null)),
            create: t.mock.method(Company, "create", overrides.create ?? (async () => {
                throw new Error("Unexpected company creation");
            })),
        };
    }

    for (const encoding of ["json", "form"]) {
        it(`persists ${encoding} registration and returns the saved company without its password`, async (t) => {
            const expectedInput = Object.fromEntries(
                Object.entries(validCompany).map(([key, value]) => [
                    key,
                    key === "hrPassword" ? value : value.trim(),
                ]),
            );
            expectedInput.hrEmail = "hr@example.com";
            const savedCompany = {
                _id: "507f1f77bcf86cd799439011",
                ...expectedInput,
                createdAt: "2026-09-27T00:00:00.000Z",
            };
            const { findOne, create } = stubDatabase(t, {
                create: async () => {
                    // Resolution on a later tick catches a missing await on persistence.
                    await setImmediate();
                    return { toObject: () => ({ ...savedCompany }) };
                },
            });

            const response = await register(validCompany, encoding);
            assert.equal(response.status, 201);
            assert.equal(findOne.mock.callCount(), 1);
            assert.deepEqual(findOne.mock.calls[0].arguments, [{ hrEmail: "hr@example.com" }]);
            assert.equal(create.mock.callCount(), 1);
            assert.deepEqual(create.mock.calls[0].arguments, [expectedInput]);
            const { hrPassword, ...publicCompany } = savedCompany;
            assert.deepEqual(response.body, publicCompany);
            assert.equal(Object.hasOwn(response.body, "hrPassword"), false);
            assert.equal(JSON.stringify(response.body).includes(hrPassword.trim()), false);
        });
    }

    const invalidValues = [
        ["missing", undefined],
        ["whitespace-only", " \t\n "],
        ["non-string", 42],
    ];
    for (const [field, message] of Object.entries(requiredFields)) {
        for (const [caseName, value] of invalidValues) {
            it(`rejects ${caseName} ${field} before using the database`, async (t) => {
                const { findOne, create } = stubDatabase(t);
                const requestBody = { ...validCompany, [field]: value };
                const response = await register(requestBody);
                assert.equal(response.status, 400);
                assert.deepEqual(response.body, { message });
                assert.equal(findOne.mock.callCount(), 0);
                assert.equal(create.mock.callCount(), 0);
            });
        }
    }

    it("rejects a request without a body before using the database", async (t) => {
        const { findOne, create } = stubDatabase(t);
        const response = await register();
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, { message: "Company name is required" });
        assert.equal(findOne.mock.callCount(), 0);
        assert.equal(create.mock.callCount(), 0);
    });

    it("rejects an existing HR email without creating another company", async (t) => {
        const { findOne, create } = stubDatabase(t, {
            findOne: async () => ({ _id: "existing-company" }),
        });
        const response = await register(validCompany);
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, { message: "HR email already exists" });
        assert.deepEqual(findOne.mock.calls[0].arguments, [{ hrEmail: "hr@example.com" }]);
        assert.equal(create.mock.callCount(), 0);
    });

    it("handles a duplicate email inserted after the initial lookup", async (t) => {
        const { findOne, create } = stubDatabase(t, {
            create: async () => {
                throw Object.assign(new Error("Duplicate key"), { code: 11000 });
            },
        });
        const response = await register(validCompany);
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, { message: "HR email already exists" });
        assert.equal(findOne.mock.callCount(), 1);
        assert.equal(create.mock.callCount(), 1);
    });

    it("returns a client error for model validation failures", async (t) => {
        stubDatabase(t, {
            create: async () => {
                throw Object.assign(new Error("Private validation details"), {
                    name: "ValidationError",
                });
            },
        });
        const response = await register(validCompany);
        assert.equal(response.status, 400);
        assert.deepEqual(response.body, { message: "Invalid company data" });
    });

    for (const operation of ["findOne", "create"]) {
        it(`returns a generic server error when ${operation} fails`, async (t) => {
            const error = new Error("Private database connection details");
            const models = stubDatabase(t, {
                [operation]: async () => { throw error; },
            });
            const loggedError = t.mock.method(console, "error", () => {});
            const response = await register(validCompany);
            assert.equal(response.status, 500);
            assert.deepEqual(response.body, { message: "Internal server error" });
            assert.equal(loggedError.mock.callCount(), 1);
            if (operation === "findOne") {
                assert.equal(models.create.mock.callCount(), 0);
            }
        });
    }
});
