import assert from "node:assert/strict";
import { once } from "node:events";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import { app } from "../src/app.js";
import { Student } from "../src/models/student.model.js";

const secret = "student-profile-route-test-secret";
const firstStudentId = "507f1f77bcf86cd799439011";
const otherStudentId = "507f1f77bcf86cd799439012";

describe("student profile routes", { concurrency: false }, () => {
    let server;
    let baseUrl;
    let originalSecret;

    before(async () => {
        originalSecret = process.env.JWT_SECRET;
        process.env.JWT_SECRET = secret;
        server = app.listen(0, "127.0.0.1");
        await once(server, "listening");
        baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/students/me/profile`;
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

    function token(studentId = firstStudentId) {
        return jwt.sign({ studentId }, secret, { expiresIn: "1h" });
    }

    async function request(method, body, studentToken = token()) {
        const response = await fetch(baseUrl, {
            method,
            headers: {
                ...(studentToken ? { Authorization: `Bearer ${studentToken}` } : {}),
                ...(body ? { "Content-Type": "application/json" } : {}),
            },
            ...(body ? { body: JSON.stringify(body) } : {}),
            signal: AbortSignal.timeout(2000),
        });
        return { status: response.status, body: await response.json() };
    }

    function mockCurrentStudent(t, activeStudentId = firstStudentId) {
        return t.mock.method(Student, "findById", (id) => {
            assert.equal(id, activeStudentId);
            const query = {
                select: () => query,
                lean: async () => ({
                    _id: activeStudentId,
                    isActive: true,
                    name: "Student Name",
                    email: "student@example.com",
                    phone: "",
                    department: "Computer Science",
                    course: "B.Tech",
                    graduationYear: null,
                    cgpa: null,
                    skills: [],
                    resumeUrl: "",
                }),
            };
            return query;
        });
    }

    it("rejects unauthenticated profile access", async () => {
        const response = await request("GET", undefined, null);
        assert.equal(response.status, 401);
        assert.deepEqual(response.body, { message: "Authentication required" });
    });

    it("retrieves only the authenticated student's own profile", async (t) => {
        const find = mockCurrentStudent(t);
        const response = await request("GET");
        assert.equal(response.status, 200);
        assert.equal(response.body.student._id, firstStudentId);
        assert.equal(response.body.student.email, "student@example.com");
        assert.equal(find.mock.callCount(), 1);
    });

    it("updates validated profile fields using the authenticated ID", async (t) => {
        mockCurrentStudent(t);
        let persistedId;
        let update;
        t.mock.method(Student, "findByIdAndUpdate", (id, changes, options) => {
            persistedId = id;
            update = changes.$set;
            assert.equal(options.returnDocument, "after");
            assert.equal(options.runValidators, true);
            const query = {
                select: () => query,
                lean: async () => ({
                    _id: id,
                    name: "Updated Student",
                    email: "student@example.com",
                    phone: "+1 555 555 5555",
                    department: "Computer Science",
                    course: "B.Tech",
                    graduationYear: 2028,
                    cgpa: 8.5,
                    skills: ["JavaScript", "Node.js"],
                    resumeUrl: "https://example.com/resume.pdf",
                }),
            };
            return query;
        });

        const response = await request("PUT", {
            name: " Updated Student ",
            phone: "+1 555 555 5555",
            department: "Computer Science",
            course: "B.Tech",
            graduationYear: 2028,
            cgpa: 8.5,
            skills: [" JavaScript ", "Node.js", "javascript"],
            resumeUrl: "https://example.com/resume.pdf",
        });

        assert.equal(response.status, 200);
        assert.equal(persistedId, firstStudentId);
        assert.deepEqual(update.skills, ["JavaScript", "Node.js"]);
        assert.equal(update.name, "Updated Student");
        assert.equal(response.body.student.cgpa, 8.5);
        assert.equal(response.body.student.phone, "+1 555 555 5555");
    });

    it("rejects invalid CGPA, graduation year, skills, and insecure resume URLs", async (t) => {
        mockCurrentStudent(t);
        const update = t.mock.method(Student, "findByIdAndUpdate", () => {
            throw new Error("Invalid inputs must not reach persistence");
        });
        for (const [body, message] of [
            [{ cgpa: 10.1 }, "CGPA must be a number between 0 and 10"],
            [{ graduationYear: 2028.5 }, /Graduation year must be a whole year/],
            [{ skills: [" "] }, /Skills must be a list/],
            [{ resumeUrl: "http://example.com/resume.pdf" }, "Resume URL must be a valid HTTPS URL"],
        ]) {
            const response = await request("PUT", body);
            assert.equal(response.status, 400);
            if (message instanceof RegExp) assert.match(response.body.message, message);
            else assert.equal(response.body.message, message);
        }
        assert.equal(update.mock.callCount(), 0);
    });

    it("rejects attempts to name another student's ID in the update body", async (t) => {
        mockCurrentStudent(t);
        const update = t.mock.method(Student, "findByIdAndUpdate", () => {
            throw new Error("A cross-account update must not run");
        });
        const response = await request("PUT", { name: "Attacker", studentId: otherStudentId });
        assert.equal(response.status, 400);
        assert.match(response.body.message, /Unsupported profile field/);
        assert.equal(update.mock.callCount(), 0);
    });

    it("uses a different signed-in student's identity for their own profile", async (t) => {
        mockCurrentStudent(t, otherStudentId);
        const update = t.mock.method(Student, "findByIdAndUpdate", (id) => {
            assert.equal(id, otherStudentId);
            const query = { select: () => query, lean: async () => ({ _id: id, name: "Other Student", email: "other@example.com" }) };
            return query;
        });
        const response = await request("PUT", { name: "Other Student" }, token(otherStudentId));
        assert.equal(response.status, 200);
        assert.equal(response.body.student._id, otherStudentId);
        assert.equal(update.mock.callCount(), 1);
    });
});
