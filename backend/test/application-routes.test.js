import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { Application } from "../src/models/application.model.js";
import { Student } from "../src/models/student.model.js";

const secret = "application-route-test-secret";
const studentId = "507f1f77bcf86cd799439011";
const applicationId = "507f1f77bcf86cd799439014";

describe("application route authentication", { concurrency: false }, () => {
    let server;
    let baseUrl;
    let originalSecret;

    before(async () => {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/applications`;
    });

    after(async () => {
        if (server) {
            await new Promise((resolve, reject) => {
                server.close((error) => error ? reject(error) : resolve());
                server.closeAllConnections();
            });
        }
        if (originalSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = originalSecret;
    });

    async function get(url, token) {
        const response = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            signal: AbortSignal.timeout(2000),
        });
        return { status: response.status, body: await response.json() };
    }

    it("requires authentication and limits the all-applications route to Admin/TPO", async () => {
        const anonymous = await get(baseUrl);
        assert.equal(anonymous.status, 401);
        const studentToken = jwt.sign({ studentId }, secret);
        const student = await get(baseUrl, studentToken);
        assert.equal(student.status, 403);
    });

    it("blocks student status changes at the route authorization layer", async () => {
        const studentToken = jwt.sign({ studentId }, secret);
        const response = await fetch(`${baseUrl}/${applicationId}/status`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${studentToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Selected" }),
            signal: AbortSignal.timeout(2000),
        });
        assert.equal(response.status, 403);
        assert.deepEqual(await response.json(), { message: "Insufficient permissions" });
    });

    it("serves the mounted student application endpoint using token identity", async (t) => {
        t.mock.method(Student, "findById", () => {
            const query = { select: () => query, lean: async () => ({ isActive: true }) };
            return query;
        });
        const find = t.mock.method(Application, "find", (filter) => {
            assert.deepEqual(filter, { student: studentId });
            const query = { sort: () => query, skip: () => query, limit: () => query, populate: () => query, lean: async () => [] };
            return query;
        });
        t.mock.method(Application, "countDocuments", async () => 0);
        t.mock.method(Application, "aggregate", async () => []);
        const studentToken = jwt.sign({ studentId }, secret);
        const response = await get(`${baseUrl}/my`, studentToken);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.applications, []);
        assert.deepEqual(response.body.summary, { total: 0, pending: 0, shortlisted: 0, selected: 0, rejected: 0 });
        assert.equal(find.mock.callCount(), 1);
    });

    it("rejects a disabled student even when their JWT has not expired", async (t) => {
        t.mock.method(Student, "findById", () => {
            const query = { select: () => query, lean: async () => ({ isActive: false }) };
            return query;
        });
        const studentToken = jwt.sign({ studentId }, secret, { expiresIn: "1h" });
        const response = await get(`${baseUrl}/my`, studentToken);
        assert.equal(response.status, 403);
        assert.deepEqual(response.body, { message: "Student account is disabled" });
    });
});
