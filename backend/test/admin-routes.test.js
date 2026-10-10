import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { Student } from "../src/models/student.model.js";

const secret = "admin-route-test-secret";
const studentId = "507f1f77bcf86cd799439011";

describe("Admin/TPO route authorization", { concurrency: false }, () => {
    let server;
    let baseUrl;
    let previousSecret;

    before(async () => {
        previousSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/admin`;
    });

    after(async () => {
        if (server) await new Promise((resolve, reject) => {
            server.close((error) => error ? reject(error) : resolve());
            server.closeAllConnections();
        });
        if (previousSecret === undefined) delete process.env.JWT_SECRET;
        else process.env.JWT_SECRET = previousSecret;
    });

    it("rejects anonymous and student access to admin statistics", async () => {
        const anonymous = await fetch(`${baseUrl}/dashboard/overview`);
        assert.equal(anonymous.status, 401);
        const studentToken = jwt.sign({ studentId }, secret);
        const student = await fetch(`${baseUrl}/dashboard/overview`, { headers: { Authorization: `Bearer ${studentToken}` } });
        assert.equal(student.status, 403);
    });

    it("allows TPO access and exercises the mounted secure student listing", async (t) => {
        const find = t.mock.method(Student, "find", () => {
            const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query, lean: async () => [] };
            return query;
        });
        t.mock.method(Student, "countDocuments", async () => 0);
        const token = jwt.sign({ role: "TPO", userId: studentId }, secret);
        const response = await fetch(`${baseUrl}/students`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(response.status, 200);
        assert.deepEqual((await response.json()).students, []);
        assert.equal(find.mock.callCount(), 1);
    });
});
