import assert from "node:assert/strict";
import { describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { Company } from "../src/models/company.model.js";
import { createCompany, getCompanies, getCompanyById, updateCompany, removeCompany } from "../src/controllers/company.controller.js";
import { authenticateToken } from "../src/middlewares/auth.middleware.js";
import { authorizeRoles } from "../src/middlewares/role.middleware.js";

const id = "507f1f77bcf86cd799439011";
function response() {
    return {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(body) { this.body = body; return this; },
    };
}
function queryChain(value) {
    const chain = {
        select: () => chain,
        sort: () => chain,
        skip: () => chain,
        limit: () => chain,
        lean: async () => value,
    };
    return chain;
}

describe("company CRUD controller", { concurrency: false }, () => {
    it("validates required create fields and persists valid fields with creator", async (t) => {
        const create = t.mock.method(Company, "create", async (doc) => ({ _id: id, ...doc, toObject() { return { _id: id, ...doc, hrPassword: "hidden" }; } }));
        let res = response();
        await createCompany({ body: { name: " ", location: "Pune", industry: "Tech" }, user: { userId: id } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(create.mock.callCount(), 0);

        res = response();
        await createCompany({ body: { name: " Acme ", location: " Pune ", industry: " Tech ", hrEmail: "HR@ACME.COM", hrPassword: "ignored" }, user: { userId: id } }, res);
        assert.equal(res.statusCode, 201);
        assert.deepEqual(create.mock.calls[0].arguments[0], { name: "Acme", location: "Pune", industry: "Tech", hrEmail: "hr@acme.com", createdBy: id });
        assert.equal(Object.hasOwn(res.body.company, "hrPassword"), false);
    });

    it("lists with pagination and filters", async (t) => {
        let actualFilter;
        t.mock.method(Company, "find", (filter) => { actualFilter = filter; return queryChain([{ _id: id, name: "Acme" }]); });
        t.mock.method(Company, "countDocuments", async () => 21);
        const res = response();
        await getCompanies({ query: { page: "2", limit: "5", industry: "Tech", location: "Pune", search: "a.cme" } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.pagination.pages, 5);
        assert.deepEqual(actualFilter.industry, { $regex: "Tech", $options: "i" });
        assert.equal(actualFilter.$or[0].name.$regex, "a\\.cme");
    });

    it("returns detail, rejects invalid IDs, updates and deletes companies", async (t) => {
        t.mock.method(Company, "findById", () => queryChain({ _id: id, name: "Acme" }));
        let res = response();
        await getCompanyById({ params: { id: "bad" } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        await getCompanyById({ params: { id } }, res);
        assert.equal(res.statusCode, 200);

        let updateInput;
        t.mock.method(Company, "findByIdAndUpdate", (_id, update) => { updateInput = update; return queryChain({ _id, name: "Acme Two" }); });
        res = response();
        await updateCompany({ params: { id }, body: { name: " Acme Two " } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(updateInput, { $set: { name: "Acme Two" } });

        t.mock.method(Company, "findByIdAndDelete", async () => null);
        res = response();
        await removeCompany({ params: { id } }, res);
        assert.equal(res.statusCode, 404);
    });
});

describe("company management authorization", () => {
    it("requires a signed token and permits only Admin or TPO roles", () => {
        const secret = "test-secret";
        const previous = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        try {
            const denied = response();
            authenticateToken({ get: () => undefined }, denied, () => assert.fail("should reject missing token"));
            assert.equal(denied.statusCode, 401);

            const req = { get: () => `Bearer ${jwt.sign({ role: "STUDENT" }, secret)}` };
            let nextCalled = false;
            authenticateToken(req, response(), () => { nextCalled = true; });
            const forbidden = response();
            authorizeRoles("ADMIN", "TPO")(req, forbidden, () => assert.fail("student should not be authorized"));
            assert.equal(forbidden.statusCode, 403);

            req.user = { role: "TPO" };
            const accepted = response();
            authorizeRoles("ADMIN", "TPO")(req, accepted, () => { nextCalled = true; });
            assert.equal(nextCalled, true);
        } finally {
            if (previous === undefined) delete process.env.JWT_SECRET;
            else process.env.JWT_SECRET = previous;
        }
    });
});
