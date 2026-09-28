import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import { app } from "../src/app.js";
import { Company } from "../src/models/company.model.js";

const credentials = {
    companyName: "  Example Company  ",
    hrEmail: "  HR@EXAMPLE.COM  ",
    hrPassword: "  secret-password  ",
};

describe("POST /api/v1/companies/login", { concurrency: false }, () => {
    let server;
    let loginUrl;

    before(async () => {
        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        loginUrl = "http://127.0.0.1:" + server.address().port + "/api/v1/companies/login";
    });

    after(async () => {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
                server.closeAllConnections();
            });
        }
    });

    async function login(body) {
        const response = await fetch(loginUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(2000),
        });
        return { status: response.status, body: await response.json() };
    }

    function stubCompany(t) {
        const company = new Company({
            companyName: "Example Company",
            hrName: "Example HR",
            hrEmail: "hr@example.com",
            hrPassword: credentials.hrPassword,
        });
        t.mock.method(Company, "findOne", async (query) => (
            query.hrEmail === company.hrEmail ? company : null
        ));
        return company;
    }

    it("completes a valid login and omits the password from the response", async (t) => {
        const company = stubCompany(t);
        const response = await login(credentials);
        assert.equal(response.status, 200);
        assert.equal(response.body.message, "Company logged in successfully");
        assert.equal(response.body.company._id, company._id.toString());
        assert.equal(response.body.company.companyName, "Example Company");
        assert.equal(response.body.company.hrEmail, "hr@example.com");
        assert.equal(Object.hasOwn(response.body.company, "hrPassword"), false);
        assert.equal(JSON.stringify(response.body).includes(credentials.hrPassword.trim()), false);
        assert.equal(company.hrPassword, credentials.hrPassword);
    });

    it("rejects a different HR email even when company name and password match", async (t) => {
        stubCompany(t);
        const response = await login({ ...credentials, hrEmail: "other@example.com" });
        assert.equal(response.status, 401);
    });

    it("rejects an incorrect company name", async (t) => {
        stubCompany(t);
        const response = await login({ ...credentials, companyName: "Other Company" });
        assert.equal(response.status, 401);
    });

    for (const password of ["incorrect-password", credentials.hrPassword.trim()]) {
        it("rejects an incorrect password (" + JSON.stringify(password) + ")", async (t) => {
            stubCompany(t);
            const response = await login({ ...credentials, hrPassword: password });
            assert.equal(response.status, 401);
        });
    }

    for (const field of Object.keys(credentials)) {
        it("rejects missing " + field + " before querying the database", async (t) => {
            const findOne = t.mock.method(Company, "findOne", async () => null);
            const response = await login({ ...credentials, [field]: undefined });
            assert.equal(response.status, 400);
            assert.equal(findOne.mock.callCount(), 0);
        });
    }

    it("returns a server error if the company lookup fails", async (t) => {
        t.mock.method(Company, "findOne", async () => {
            throw new Error("Database unavailable");
        });
        t.mock.method(console, "error", () => {});
        const response = await login(credentials);
        assert.equal(response.status, 500);
        assert.equal(response.body.message, "Error logging in company");
    });
});
