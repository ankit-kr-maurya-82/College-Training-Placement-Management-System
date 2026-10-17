import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Application } from "../src/models/application.model.js";
import { Company } from "../src/models/company.model.js";
import { Drive } from "../src/models/drive.model.js";
import { Student } from "../src/models/student.model.js";
import {
    getAdminStudentById,
    getAdminStudents,
    getApplicationAnalytics,
    getCompanyAnalytics,
    getDashboardOverview,
    getDriveAnalytics,
    getPlacementAnalytics,
    updateAdminStudentStatus,
} from "../src/controllers/admin.controller.js";

const id = "507f1f77bcf86cd799439011";
const response = () => ({ statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
function queryChain(value) {
    const query = { select: () => query, sort: () => query, skip: () => query, limit: () => query, lean: async () => value };
    return query;
}

describe("admin dashboard and analytics", { concurrency: false }, () => {
    it("returns actual aggregate counts and a clearly denominated alternative rate", async (t) => {
        t.mock.method(Student, "countDocuments", async (filter) => filter.isActive ? 5 : 6);
        t.mock.method(Company, "countDocuments", async () => 3);
        t.mock.method(Drive, "countDocuments", async () => 8);
        t.mock.method(Drive, "aggregate", async () => [{
            byStatus: [{ _id: "Published", count: 3 }, { _id: "Closed", count: 2 }], upcoming: [{ count: 1 }], activePublished: [{ count: 2 }],
        }]);
        t.mock.method(Application, "aggregate", async () => [
            { _id: "Applied", applications: 4, students: ["a", "b", "c", "d"] },
            { _id: "Shortlisted", applications: 2, students: ["a", "b"] },
            { _id: "Selected", applications: 1, students: ["a"] },
            { _id: "Rejected", applications: 1, students: ["e"] },
        ]);
        const res = response();
        await getDashboardOverview({}, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.students, { total: 6, active: 5 });
        assert.deepEqual(res.body.companies, { total: 3 });
        assert.deepEqual(res.body.drives, { total: 8, published: 3, activePublished: 2, closed: 2, upcoming: 1 });
        assert.equal(res.body.drives.activePublished, 2);
        assert.equal(res.body.applications.total, 8);
        assert.equal(res.body.applications.awaitingReview, 4);
        assert.equal(res.body.applications.shortlistedStudents, 2);
        assert.equal(res.body.applications.selectedStudents, 1);
        assert.equal(res.body.applications.placementPercentage, 16.67);
        assert.equal(res.body.applications.placementPercentageNumerator, 1);
        assert.equal(res.body.applications.placementPercentageDenominator, 6);
        assert.deepEqual(res.body.applications.byStatus.map(({ status }) => status), ["Applied", "Under Review", "Shortlisted", "Interview Scheduled", "Selected", "Rejected", "Withdrawn"]);
        assert.equal(res.body.applications.rejected, 1);
        assert.equal(res.body.applications.applicationSelectionRate, 12.5);
    });

    it("returns safe zero values for empty collections", async (t) => {
        t.mock.method(Student, "countDocuments", async () => 0);
        t.mock.method(Company, "countDocuments", async () => 0);
        t.mock.method(Drive, "countDocuments", async () => 0);
        t.mock.method(Drive, "aggregate", async () => [{ byStatus: [], upcoming: [] }]);
        t.mock.method(Application, "aggregate", async () => []);
        const res = response();
        await getDashboardOverview({}, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.applications.applicationSelectionRate, 0);
        assert.equal(res.body.applications.placementPercentage, 0);
        assert.equal(res.body.applications.placementPercentageNumerator, 0);
        assert.equal(res.body.applications.placementPercentageDenominator, 0);
        assert.equal(res.body.drives.upcoming, 0);
        assert.equal(res.body.applications.total, 0);
    });

    it("aggregates status and time series with date, granularity, and graduating-class filters", async (t) => {
        t.mock.method(Application, "aggregate", async () => [
            { _id: "Applied", count: 2 },
            { _id: "Selected", count: 1 },
        ]);
        const res = response();
        await getApplicationAnalytics({ query: { startDate: "2026-01-01", endDate: "2026-12-31", graduationYear: "2027", granularity: "day" } }, res);
        assert.equal(res.statusCode, 200);
        assert.equal(res.body.applicationsByStatus.find((row) => row.status === "Applied").count, 2);
        const calls = Application.aggregate.mock.calls;
        assert.equal(calls.length, 2);
        assert.deepEqual(calls[0].arguments[0][0].$match.appliedAt, { $gte: new Date("2026-01-01"), $lte: new Date("2026-12-31") });
        assert.equal(calls[0].arguments[0].find((stage) => stage.$match?.["studentRecord.graduationYear"]) .$match["studentRecord.graduationYear"], 2027);
        assert.equal(calls[1].arguments[0].at(-2).$group._id.$dateToString.format, "%Y-%m-%d");
        const invalid = response();
        await getApplicationAnalytics({ query: { startDate: "2027-01-01", endDate: "2026-01-01" } }, invalid);
        assert.equal(invalid.statusCode, 400);
    });

    it("returns placement and company rankings from application records", async (t) => {
        const ranking = [{ company: { id, name: "Example Co" }, applicationCount: 9, selectedApplicationCount: 2, selectedStudentCount: 2 }];
        t.mock.method(Application, "aggregate", async () => ranking);
        let res = response();
        await getPlacementAnalytics({ query: { graduationYear: "2027", limit: "5" } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.selectedStudentsByCompany, ranking);
        const placementsPipeline = Application.aggregate.mock.calls[0].arguments[0];
        assert.equal(placementsPipeline[0].$match.status, "Selected");
        assert.ok(placementsPipeline.some((stage) => stage.$lookup?.from === Drive.collection.name));
        assert.ok(placementsPipeline.some((stage) => stage.$group?.selectedStudents?.$addToSet), "selected students are deduplicated before counting");
        res = response();
        await getCompanyAnalytics({ query: { company: id, startDate: "2026-01-01" } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.topCompaniesByApplicationCount, ranking);
        const companiesPipeline = Application.aggregate.mock.calls[1].arguments[0];
        const companyMatch = companiesPipeline.find((stage) => stage.$match?.["driveRecord.company"]);
        assert.ok(companyMatch.$match["driveRecord.company"].equals(id));
        assert.equal(companiesPipeline.at(-1).$limit, 20);
    });

    it("rejects invalid analytics date filters before querying", async (t) => {
        t.mock.method(Application, "aggregate", async () => []);
        let res = response();
        await getApplicationAnalytics({ query: { startDate: "not-a-date" } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(Application.aggregate.mock.callCount(), 0);
        res = response();
        await getPlacementAnalytics({ query: { startDate: "2026-01-01", endDate: "2026-01-01T00:00:00Z", limit: "1000" } }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(Application.aggregate.mock.callCount(), 0);
    });

    it("groups drives by status and validates filters", async (t) => {
        t.mock.method(Drive, "aggregate", async () => [{ _id: "Published", count: 4 }, { _id: "Closed", count: 1 }]);
        const res = response();
        await getDriveAnalytics({ query: { startDate: "2026-01-01", graduationYear: "2027", status: "Published" } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.drivesByStatus.find((row) => row.status === "Published"), { status: "Published", count: 4 });
        const filter = Drive.aggregate.mock.calls[0].arguments[0][0].$match;
        assert.equal(filter.status, "Published");
        assert.equal(filter["eligibility.graduationYear"], 2027);
        assert.ok(filter.createdAt.$gte instanceof Date);
        const invalid = response();
        await getDriveAnalytics({ query: { status: "Broken" } }, invalid);
        assert.equal(invalid.statusCode, 400);
    });
});

describe("Admin student management", { concurrency: false }, () => {
    it("paginates and filters using available student fields without exposing secrets", async (t) => {
        let filter;
        let projection;
        t.mock.method(Student, "find", (query) => { filter = query; const chain = queryChain([{ _id: id, name: "Ada", email: "ada@example.edu", resetPasswordToken: "private" }]); const select = chain.select; chain.select = (fields) => { projection = fields; return select(fields); }; return chain; });
        t.mock.method(Student, "countDocuments", async () => 1);
        const res = response();
        await getAdminStudents({ query: { search: "ada", branch: "CSE", graduationYear: "2027", status: "active", page: "2", limit: "5" } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(res.body.pagination, { page: 2, limit: 5, total: 1, pages: 1 });
        assert.equal(filter.graduationYear, 2027);
        assert.deepEqual(filter.isActive, { $ne: false });
        assert.equal(filter.$and.length, 2);
        assert.equal(projection.includes("password"), false);
        assert.equal(projection.includes("resetPasswordToken"), false);
        assert.equal(Object.hasOwn(res.body.students[0], "resetPasswordToken"), false);
        assert.equal(res.body.students[0].isActive, true);
    });

    it("validates student IDs and account-status updates", async (t) => {
        let res = response();
        await getAdminStudentById({ params: { id: "invalid" } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        await updateAdminStudentStatus({ params: { id }, body: { isActive: "false" } }, res);
        assert.equal(res.statusCode, 400);
        res = response();
        await updateAdminStudentStatus({ params: { id }, body: { isActive: false, role: "ADMIN" } }, res);
        assert.equal(res.statusCode, 400);

        let update;
        t.mock.method(Student, "findByIdAndUpdate", (studentId, change, options) => { update = { studentId, change, options }; return queryChain({ _id: studentId, name: "Ada", isActive: false }); });
        res = response();
        await updateAdminStudentStatus({ params: { id }, body: { isActive: false } }, res);
        assert.equal(res.statusCode, 200);
        assert.deepEqual(update.change, { $set: { isActive: false } });
        assert.equal(update.options.runValidators, true);
    });
});
