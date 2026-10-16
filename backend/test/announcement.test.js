import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Announcement } from "../src/models/announcement.model.js";
import { createAnnouncement, listStudentAnnouncements, publishAnnouncement } from "../src/controllers/announcement.controller.js";

const managerId = "507f1f77bcf86cd799439011";
const announcementId = "507f1f77bcf86cd799439012";
function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function query(value) {
    const chain = { select: () => chain, sort: () => chain, limit: () => chain, lean: async () => value };
    return chain;
}

describe("placement announcements", { concurrency: false }, () => {
    it("shows only published announcements to students and caps the feed", async (t) => {
        const rows = [{ _id: announcementId, title: "Drive update", publishedAt: new Date() }];
        let filter;
        const find = t.mock.method(Announcement, "find", (value) => { filter = value; return query(rows); });
        const res = response();
        await listStudentAnnouncements({}, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.announcements, rows);
        assert.ok(filter.publishedAt.$lte instanceof Date);
        assert.equal(filter.publishedAt.$ne, null);
        assert.equal(find.mock.callCount(), 1);
    });

    it("creates a draft attributed to the authenticated manager and rejects invalid input", async (t) => {
        const create = t.mock.method(Announcement, "create", async (value) => value);
        let res = response();
        await createAnnouncement({ body: { title: " ", body: "message" }, user: { userId: managerId } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(create.mock.callCount(), 0);
        res = response();
        await createAnnouncement({ body: { title: " Career fair ", body: " Details " }, user: { userId: managerId } }, res);
        assert.equal(res.statusCode, 201);
        assert.deepEqual(create.mock.calls[0].arguments[0], { title: "Career fair", body: "Details", createdBy: managerId });
        assert.equal(Object.hasOwn(create.mock.calls[0].arguments[0], "publishedAt"), false);
    });

    it("requires a manager identity and does not accept client-supplied ownership", async (t) => {
        const create = t.mock.method(Announcement, "create", async () => assert.fail("must not create"));
        let res = response();
        await createAnnouncement({ body: { title: "Notice", body: "Details", createdBy: announcementId }, user: { userId: managerId } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        await createAnnouncement({ body: { title: "Notice", body: "Details" }, user: {} }, res);
        assert.equal(res.statusCode, 401);
        assert.equal(create.mock.callCount(), 0);
    });

    it("publishes a draft once and rejects invalid or missing IDs", async (t) => {
        const draft = { _id: announcementId, publishedAt: null, save: async function () { return this; } };
        const find = t.mock.method(Announcement, "findById", async () => draft);
        let res = response();
        await publishAnnouncement({ params: { id: "bad" } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(find.mock.callCount(), 0);
        res = response();
        await publishAnnouncement({ params: { id: announcementId } }, res);
        assert.equal(res.statusCode, 200);
        assert.ok(draft.publishedAt instanceof Date);
        assert.equal(find.mock.callCount(), 1);
    });
});
