import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Application } from "../src/models/application.model.js";
import { Interview } from "../src/models/interview.model.js";
import {
    cancelInterview,
    completeInterview,
    createInterview,
    listCompanyInterviews,
    listStudentInterviews,
    rescheduleInterview,
} from "../src/controllers/interview.controller.js";
import { setTransportFactory } from "../src/services/vacancy-email.service.js";

const companyId = "507f1f77bcf86cd799439011";
const otherCompanyId = "507f1f77bcf86cd799439012";
const studentId = "507f1f77bcf86cd799439013";
const applicationId = "507f1f77bcf86cd799439014";
const interviewId = "507f1f77bcf86cd799439015";

function response() {
    return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function query(value) {
    const result = {
        populate: () => result,
        sort: () => result,
        skip: () => result,
        limit: () => result,
        lean: async () => value,
    };
    return result;
}

function validSchedule(overrides = {}) {
    const startAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
    return {
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        timeZone: "Asia/Kolkata",
        mode: "ONLINE",
        meetingLink: "https://meet.example.edu/room/123",
        instructions: "Bring your portfolio",
        ...overrides,
    };
}

function application(overrides = {}) {
    return {
        _id: applicationId,
        status: "Shortlisted",
        appliedAt: new Date("2026-01-01T00:00:00.000Z"),
        student: { _id: studentId, name: "Student Name", email: "student@example.edu", department: "CSE", course: "B.Tech" },
        drive: { _id: "507f1f77bcf86cd799439016", title: "Software Engineer", company: { _id: companyId, name: "Example Company" } },
        ...overrides,
    };
}

function scheduledInterview(overrides = {}) {
    const schedule = validSchedule();
    return {
        _id: interviewId,
        application: applicationId,
        student: { _id: studentId, name: "Student Name", email: "student@example.edu" },
        company: { _id: companyId, name: "Example Company" },
        drive: { _id: "507f1f77bcf86cd799439016", title: "Software Engineer" },
        ...schedule,
        status: "SCHEDULED",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
        events: [],
        ...overrides,
    };
}

function request(user, { body = {}, id = interviewId, key = "request-key-0001", query: queryParams = {} } = {}) {
    return {
        user,
        body,
        params: { id },
        query: queryParams,
        headers: { "idempotency-key": key },
        get(name) { return this.headers[name.toLowerCase()]; },
    };
}

function mockMail(t, { fail = false } = {}) {
    const old = Object.fromEntries(["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"].map((key) => [key, process.env[key]]));
    Object.assign(process.env, { SMTP_HOST: "smtp.test", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USER: "sender@example.edu", SMTP_PASS: "mock-secret", EMAIL_FROM: "sender@example.edu" });
    const messages = [];
    setTransportFactory(async () => ({ sendMail: async (message) => {
        messages.push(message);
        if (fail) throw Object.assign(new Error("mock SMTP failure"), { code: "E_TEST" });
    } }));
    t.after(() => {
        for (const [key, value] of Object.entries(old)) {
            if (value === undefined) delete process.env[key];
            else process.env[key] = value;
        }
        setTransportFactory(async (options) => (await import("nodemailer")).createTransport(options));
    });
    return messages;
}

describe("interview scheduling", { concurrency: false }, () => {
    it("creates an interview for an application owned by the authenticated company and emails its student", async (t) => {
        const messages = mockMail(t);
        t.mock.method(Interview, "findOne", () => query(null));
        t.mock.method(Application, "findById", (id) => {
            assert.equal(id, applicationId);
            return query(application());
        });
        let created;
        t.mock.method(Interview, "create", async (document) => {
            created = document;
            const saved = { _id: interviewId, ...document };
            return { toObject: () => saved };
        });
        const updates = t.mock.method(Interview, "updateOne", async () => ({ modifiedCount: 1 }));
        const res = response();
        await createInterview(request({ role: "COMPANY", companyId }, { body: { applicationId, ...validSchedule() } }), res);
        assert.equal(res.statusCode, 201);
        assert.equal(String(created.company), companyId);
        assert.equal(String(created.student), studentId);
        assert.equal(String(created.application), applicationId);
        assert.equal(created.status, "SCHEDULED");
        assert.equal(created.events[0].action, "SCHEDULED");
        assert.equal(created.events[0].notificationStatus, "PENDING");
        assert.equal(messages.length, 1);
        assert.equal(messages[0].to, "student@example.edu");
        assert.match(messages[0].text, /Asia\/Kolkata/);
        assert.match(messages[0].text, /https:\/\/meet\.example\.edu/);
        assert.equal(updates.mock.callCount(), 2);
    });

    it("rejects missing fields, invalid dates, ranges, time zones, modes, and meeting URLs", async (t) => {
        const create = t.mock.method(Interview, "create", async () => assert.fail("invalid scheduling input must not be persisted"));
        const appLookup = t.mock.method(Application, "findById", () => assert.fail("input validation must run before application lookup"));
        const invalidBodies = [
            {},
            { applicationId, ...validSchedule({ startAt: "tomorrow" }) },
            { applicationId, ...validSchedule({ endAt: validSchedule().startAt }) },
            { applicationId, ...validSchedule({ timeZone: "Not/A_Timezone" }) },
            { applicationId, ...validSchedule({ mode: "VIDEO" }) },
            { applicationId, ...validSchedule({ meetingLink: "http://meet.example.edu" }) },
            { applicationId, ...validSchedule({ mode: "OFFLINE", meetingLink: undefined, venue: "  " }) },
        ];
        for (const body of invalidBodies) {
            const res = response();
            await createInterview(request({ role: "COMPANY", companyId }, { body }), res);
            assert.equal(res.statusCode, 400);
        }
        assert.equal(create.mock.callCount(), 0);
        assert.equal(appLookup.mock.callCount(), 0);
    });

    it("hides an application from an unrelated company and rejects missing idempotency keys", async (t) => {
        t.mock.method(Interview, "findOne", () => query(null));
        t.mock.method(Application, "findById", () => query(application({ drive: { _id: "507f1f77bcf86cd799439016", title: "Other role", company: { _id: otherCompanyId } } })));
        const create = t.mock.method(Interview, "create", async () => assert.fail("a foreign company must not schedule"));
        const foreign = response();
        await createInterview(request({ role: "COMPANY", companyId }, { body: { applicationId, ...validSchedule() } }), foreign);
        assert.equal(foreign.statusCode, 404);
        const missingKey = request({ role: "COMPANY", companyId }, { body: { applicationId, ...validSchedule() } });
        missingKey.headers = {};
        const badKey = response();
        await createInterview(missingKey, badKey);
        assert.equal(badKey.statusCode, 400);
        assert.equal(create.mock.callCount(), 0);
    });

    it("returns an existing interview for a retried idempotency key without resending mail", async (t) => {
        const messages = mockMail(t);
        const existing = scheduledInterview();
        t.mock.method(Interview, "findOne", (filter) => {
            assert.equal(filter.company, companyId);
            assert.equal(filter["events.requestId"], "request-key-0001");
            return query(existing);
        });
        const create = t.mock.method(Interview, "create", async () => assert.fail("replayed requests must not create another interview"));
        const res = response();
        await createInterview(request({ role: "COMPANY", companyId }, { body: { applicationId, ...validSchedule() } }), res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.replayed, true);
        assert.equal(res.body.interview._id, interviewId);
        assert.equal(create.mock.callCount(), 0);
        assert.equal(messages.length, 0);
    });

    it("lists only the authenticated student's interviews and applies status and upcoming filters", async (t) => {
        let filter;
        t.mock.method(Interview, "find", (value) => { filter = value; return query([]); });
        t.mock.method(Interview, "countDocuments", async () => 0);
        const res = response();
        await listStudentInterviews(request({ studentId }, { query: { period: "upcoming", status: "SCHEDULED", student: otherCompanyId } }), res);
        assert.equal(res.statusCode, 200);
        assert.equal(filter.$and[0].student, studentId);
        assert.equal(filter.$and[1].status, "SCHEDULED");
        assert.equal(filter.$and[2].status, "SCHEDULED");
        assert.ok(filter.$and[2].startAt.$gt instanceof Date);
        assert.deepEqual(res.body.interviews, []);
        const companyFilter = response();
        t.mock.method(Interview, "find", (value) => { filter = value; return query([]); });
        await listCompanyInterviews(request({ companyId }), companyFilter);
        assert.equal(filter.company, companyId);
    });

    it("reschedules with an event snapshot and rejects unrelated-company rescheduling", async (t) => {
        const messages = mockMail(t);
        const current = scheduledInterview();
        const newStartAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
        const newSchedule = validSchedule({ startAt: newStartAt.toISOString(), endAt: new Date(newStartAt.getTime() + 60 * 60 * 1000).toISOString() });
        const updated = { ...current, ...newSchedule, events: [{ action: "RESCHEDULED" }] };
        let currentDocument = current;
        t.mock.method(Interview, "findOne", (filter) => query(filter._id ? currentDocument : null));
        let updateFilter;
        t.mock.method(Interview, "findOneAndUpdate", (filter) => { updateFilter = filter; return query(updated); });
        t.mock.method(Interview, "updateOne", async () => ({ modifiedCount: 1 }));
        const res = response();
        await rescheduleInterview(request({ role: "COMPANY", companyId }, { body: newSchedule }), res);
        assert.equal(res.statusCode, 200);
        assert.equal(updateFilter.company, companyId);
        assert.equal(updateFilter.status, "SCHEDULED");
        assert.equal(res.body.interview.startAt, updated.startAt);
        assert.equal(messages.length, 1);

        currentDocument = null;
        const foreign = response();
        await rescheduleInterview(request({ role: "COMPANY", companyId: otherCompanyId }), foreign);
        assert.equal(foreign.statusCode, 404);
    });

    it("cancels an interview with one student notification and refuses terminal-state changes", async (t) => {
        const messages = mockMail(t);
        const current = scheduledInterview();
        t.mock.method(Interview, "findOne", (filter) => query(filter._id ? current : null));
        let update;
        t.mock.method(Interview, "findOneAndUpdate", (filter, changes) => {
            update = { filter, changes };
            return query({ ...current, status: "CANCELLED", events: [{ action: "CANCELLED" }] });
        });
        t.mock.method(Interview, "updateOne", async () => ({ modifiedCount: 1 }));
        const res = response();
        await cancelInterview(request({ role: "COMPANY", companyId }, { body: { note: "Company emergency" } }), res);
        assert.equal(res.statusCode, 200);
        assert.equal(update.filter.company, companyId);
        assert.equal(update.changes.$set.status, "CANCELLED");
        assert.equal(update.changes.$push.events.action, "CANCELLED");
        assert.equal(messages.length, 1);
        assert.match(messages[0].text, /cancelled/);

        let currentDocument = { ...current, status: "COMPLETED" };
        t.mock.method(Interview, "findOne", (filter) => query(filter._id ? currentDocument : null));
        const terminal = response();
        await completeInterview(request({ role: "COMPANY", companyId }, { key: "request-key-0002" }), terminal);
        assert.equal(terminal.statusCode, 409);
    });

    it("keeps a scheduled interview when SMTP delivery fails and records failure", async (t) => {
        const messages = mockMail(t, { fail: true });
        t.mock.method(Interview, "findOne", () => query(null));
        t.mock.method(Application, "findById", () => query(application()));
        t.mock.method(Interview, "create", async (document) => {
            const saved = { _id: interviewId, ...document };
            return { toObject: () => saved };
        });
        const updates = [];
        t.mock.method(Interview, "updateOne", async (_filter, change) => { updates.push(change.$set["events.$.notificationStatus"]); return { modifiedCount: 1 }; });
        t.mock.method(console, "error", () => {});
        const res = response();
        await createInterview(request({ role: "COMPANY", companyId }, { body: { applicationId, ...validSchedule() } }), res);
        assert.equal(res.statusCode, 201);
        assert.equal(res.body.interview.status, "SCHEDULED");
        assert.deepEqual(updates, ["SENDING", "FAILED"]);
        assert.equal(messages.length, 1);
    });

    it("keeps the scheduled index unique per application and only permits valid lifecycle transitions", async (t) => {
        const activeIndex = Interview.schema.indexes().find(([fields, options]) => fields.application === 1 && options.unique && options.partialFilterExpression?.status === "SCHEDULED");
        assert.ok(activeIndex);
        let current = scheduledInterview();
        t.mock.method(Interview, "findOne", (filter) => query(filter._id ? current : null));
        t.mock.method(Interview, "findOneAndUpdate", (_filter, changes) => query({ ...current, status: changes.$set.status }));
        t.mock.method(Interview, "updateOne", async () => ({ modifiedCount: 0 }));
        const completed = response();
        await completeInterview(request({ role: "COMPANY", companyId }), completed);
        assert.equal(completed.statusCode, 200);
        assert.equal(completed.body.interview.status, "COMPLETED");
        const changedAgain = response();
        current = { ...current, status: "CANCELLED" };
        await cancelInterview(request({ role: "COMPANY", companyId }, { key: "request-key-0003" }), changedAgain);
        assert.equal(changedAgain.statusCode, 409);
    });
});
