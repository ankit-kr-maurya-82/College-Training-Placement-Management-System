import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Company } from "../src/models/company.model.js";
import { Student } from "../src/models/student.model.js";
import { uploadCompanyProfilePicture, uploadStudentProfilePicture } from "../src/controllers/profile-picture.controller.js";
import { getMyStudentProfile } from "../src/controllers/student-profile.controller.js";
import { authenticateToken } from "../src/middlewares/auth.middleware.js";
import { detectImageMime, receiveProfilePicture, validateProfilePicture } from "../src/middlewares/profile-picture-upload.middleware.js";
import { deleteProfilePicture, setCloudinaryOperationsForTests, uploadProfilePicture } from "../src/services/cloudinary.service.js";

const studentId = "507f1f77bcf86cd799439011";
const companyId = "507f1f77bcf86cd799439012";
const oldPublicId = "college-placement/profile-pictures/old";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a+0AAAAASUVORK5CYII=", "base64");

function response() {
    return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function updateQuery(value) { const query = { select: () => query, lean: async () => value }; return query; }
function uploadRequest(file = png, account = {}) {
    return { user: { studentId, ...account }, body: { studentId: "507f1f77bcf86cd799439099" }, file: { buffer: file, mimetype: "image/png", originalname: "renamed.dat" }, studentAccount: { profilePictureUrl: "https://res.cloudinary.com/demo/old.png", profilePicturePublicId: oldPublicId }, company: { profilePicturePublicId: oldPublicId } };
}
function withMultipart(file, mime, field = "profilePicture") {
    const boundary = "profile-picture-test-boundary";
    const prefix = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="image.anything"\r\nContent-Type: ${mime}\r\n\r\n`);
    const suffix = Buffer.from(`\r\n--${boundary}--\r\n`);
    const body = Buffer.concat([prefix, file, suffix]);
    const req = Readable.from([body]);
    req.headers = { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(body.length) };
    req.method = "POST";
    return req;
}

test.afterEach(() => setCloudinaryOperationsForTests(null));

test("student uploads a picture against the authenticated student ID and replaces the old asset after database success", async (t) => {
    const events = [];
    setCloudinaryOperationsForTests({
        upload: async (buffer, options) => { assert.deepEqual(buffer, png); assert.equal(options.folder, "college-placement/profile-pictures"); events.push("upload"); return { secure_url: "https://res.cloudinary.com/demo/new.png", public_id: "college-placement/profile-pictures/new" }; },
        destroy: async (id) => { events.push(`delete:${id}`); },
    });
    let id;
    let update;
    t.mock.method(Student, "findByIdAndUpdate", (accountId, changes) => { id = accountId; update = changes.$set; events.push("database"); return updateQuery({ profilePictureUrl: "https://res.cloudinary.com/demo/new.png" }); });
    const res = response();
    await uploadStudentProfilePicture(uploadRequest(png), res);
    assert.equal(res.statusCode, 200);
    assert.equal(id, studentId);
    assert.deepEqual(update, { profilePictureUrl: "https://res.cloudinary.com/demo/new.png", profilePicturePublicId: "college-placement/profile-pictures/new" });
    assert.deepEqual(events, ["upload", "database", `delete:${oldPublicId}`]);
    assert.deepEqual(res.body.student, { profilePictureUrl: "https://res.cloudinary.com/demo/new.png" });
});

test("company can upload its own profile picture without replacing the existing company logo", async (t) => {
    setCloudinaryOperationsForTests({
        upload: async (_buffer, options) => { assert.equal(options.folder, "college-placement/profile-pictures"); return { secure_url: "https://res.cloudinary.com/demo/company.png", public_id: "college-placement/profile-pictures/company" }; },
        destroy: async () => {},
    });
    let persistedId;
    let updates;
    t.mock.method(Company, "findByIdAndUpdate", (id, change) => { persistedId = id; updates = change.$set; return updateQuery({ profilePictureUrl: "https://res.cloudinary.com/demo/company.png" }); });
    const req = { user: { role: "COMPANY", companyId }, body: { companyId: studentId }, file: { buffer: png, mimetype: "image/png" }, company: {} };
    const res = response();
    await uploadCompanyProfilePicture(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(persistedId, companyId);
    assert.equal(Object.hasOwn(updates, "logo"), false);
    assert.equal(res.body.company.profilePictureUrl, "https://res.cloudinary.com/demo/company.png");
});

test("upload controller rejects missing authentication and token middleware rejects anonymous access", async () => {
    const res = response();
    await uploadStudentProfilePicture({ user: {}, file: { buffer: png } }, res);
    assert.equal(res.statusCode, 403);
    const authRes = response();
    authenticateToken({ get: () => undefined }, authRes, () => assert.fail("anonymous upload must not reach the route handler"));
    assert.equal(authRes.statusCode, 401);
});

test("image validation rejects unsupported MIME, mismatched file contents, and oversize files", (t) => {
    assert.equal(detectImageMime(png), "image/png");
    assert.equal(validateProfilePicture({ buffer: png, mimetype: "image/gif" }).status, 415);
    assert.equal(validateProfilePicture({ buffer: Buffer.from("not an image"), mimetype: "image/png" }).status, 400);
    const previousLimit = process.env.PROFILE_PICTURE_MAX_BYTES;
    process.env.PROFILE_PICTURE_MAX_BYTES = "16";
    t.after(() => { if (previousLimit === undefined) delete process.env.PROFILE_PICTURE_MAX_BYTES; else process.env.PROFILE_PICTURE_MAX_BYTES = previousLimit; });
    assert.equal(validateProfilePicture({ buffer: png, mimetype: "image/png" }).status, 413);
});

test("multipart middleware rejects files over the configured size limit", async (t) => {
    const previousLimit = process.env.PROFILE_PICTURE_MAX_BYTES;
    process.env.PROFILE_PICTURE_MAX_BYTES = "64";
    t.after(() => { if (previousLimit === undefined) delete process.env.PROFILE_PICTURE_MAX_BYTES; else process.env.PROFILE_PICTURE_MAX_BYTES = previousLimit; });
    const req = withMultipart(Buffer.alloc(128, 1), "image/png");
    const res = response();
    await new Promise((resolve) => {
        const json = res.json.bind(res);
        res.json = (body) => { json(body); resolve(); return res; };
        receiveProfilePicture(req, res, resolve);
    });
    assert.equal(res.statusCode, 413, JSON.stringify(res.body));
});

test("multipart middleware rejects unsupported declared types and content that does not match the MIME type", async () => {
    async function send(req) {
        const res = response();
        await new Promise((resolve) => {
            const json = res.json.bind(res);
            res.json = (body) => { json(body); resolve(); return res; };
            receiveProfilePicture(req, res, resolve);
        });
        return res;
    }
    const unsupported = await send(withMultipart(png, "image/gif"));
    assert.equal(unsupported.statusCode, 415);
    const malformed = await send(withMultipart(Buffer.from("not an image"), "image/png"));
    assert.equal(malformed.statusCode, 400);
});

test("Cloudinary failure leaves the prior profile picture untouched", async (t) => {
    setCloudinaryOperationsForTests({ upload: async () => { throw new Error("private Cloudinary request detail"); }, destroy: async () => assert.fail("no asset should be deleted") });
    const update = t.mock.method(Student, "findByIdAndUpdate", () => assert.fail("database must not be changed"));
    const res = response();
    await uploadStudentProfilePicture(uploadRequest(), res);
    assert.equal(res.statusCode, 502);
    assert.deepEqual(res.body, { message: "Profile picture upload failed. Please try again." });
    assert.equal(update.mock.callCount(), 0);
});

test("database update failure cleans up the new upload but preserves the previous Cloudinary asset", async (t) => {
    const deleted = [];
    setCloudinaryOperationsForTests({ upload: async () => ({ secure_url: "https://res.cloudinary.com/demo/new.png", public_id: "college-placement/profile-pictures/new" }), destroy: async (id) => deleted.push(id) });
    t.mock.method(Student, "findByIdAndUpdate", () => { throw new Error("database failure"); });
    t.mock.method(console, "error", () => {});
    const res = response();
    await uploadStudentProfilePicture(uploadRequest(), res);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(deleted, ["college-placement/profile-pictures/new"]);
    assert.equal(deleted.includes(oldPublicId), false);
});

test("old asset cleanup failure does not invalidate a successfully saved new picture", async (t) => {
    setCloudinaryOperationsForTests({
        upload: async () => ({ secure_url: "https://res.cloudinary.com/demo/new.png", public_id: "college-placement/profile-pictures/new" }),
        destroy: async (id) => { if (id === oldPublicId) throw new Error("private cleanup detail"); },
    });
    t.mock.method(Student, "findByIdAndUpdate", () => updateQuery({ profilePictureUrl: "https://res.cloudinary.com/demo/new.png" }));
    t.mock.method(console, "warn", () => {});
    const res = response();
    await uploadStudentProfilePicture(uploadRequest(), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.student.profilePictureUrl, "https://res.cloudinary.com/demo/new.png");
});

test("profiles without an existing picture remain compatible", async () => {
    const res = response();
    await getMyStudentProfile({ studentAccount: { _id: studentId, name: "Student", email: "student@example.test" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.student.profilePictureUrl, "");
});

test("Cloudinary cleanup is a no-op for an empty public ID", async () => {
    assert.equal(await deleteProfilePicture(""), undefined);
});

test("missing Cloudinary credentials fail safely without attempting an upload", async () => {
    const keys = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    for (const key of keys) delete process.env[key];
    try {
        await assert.rejects(uploadProfilePicture(png), (error) => error.code === "CLOUDINARY_NOT_CONFIGURED");
    } finally {
        for (const key of keys) {
            if (previous[key] === undefined) delete process.env[key];
            else process.env[key] = previous[key];
        }
    }
});
