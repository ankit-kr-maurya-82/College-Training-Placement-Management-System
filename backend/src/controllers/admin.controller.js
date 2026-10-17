import mongoose from "mongoose";
import { Application } from "../models/application.model.js";
import { Company } from "../models/company.model.js";
import { Drive } from "../models/drive.model.js";
import { Student } from "../models/student.model.js";

const applicationStatuses = ["Applied", "Under Review", "Shortlisted", "Interview Scheduled", "Selected", "Rejected", "Withdrawn"];
const driveStatuses = ["Draft", "Published", "Closed", "Cancelled"];
const studentProjection = "name email rollNumber department course graduationYear cgpa tenthPercentage twelfthPercentage activeBacklogs skills isActive createdAt updatedAt";
const studentResponseFields = ["_id", "name", "email", "rollNumber", "department", "course", "graduationYear", "cgpa", "tenthPercentage", "twelfthPercentage", "activeBacklogs", "skills", "createdAt", "updatedAt"];
const validId = (value) => /^[a-f\d]{24}$/i.test(value ?? "");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function handleError(res, error, operation) {
    if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: "Invalid request data" });
    console.error(`Error ${operation}:`, error);
    return res.status(500).json({ message: "Internal server error" });
}

function dateRange(query) {
    const match = {};
    let start;
    let end;
    for (const [key, value] of [["startDate", query.startDate], ["endDate", query.endDate]]) {
        if (value === undefined) continue;
        const date = new Date(String(value));
        if (!Number.isFinite(date.getTime())) return { error: `${key} must be a valid date` };
        if (key === "startDate") start = date;
        else end = date;
    }
    if (start && end && start > end) return { error: "startDate must be before or equal to endDate" };
    if (start && end && end - start > 5 * 366 * 24 * 60 * 60 * 1000) return { error: "Date range cannot exceed five years" };
    if (start || end) match.appliedAt = { ...(start ? { $gte: start } : {}), ...(end ? { $lte: end } : {}) };
    return { match, start, end };
}

function graduationYear(query) {
    if (query.graduationYear === undefined) return {};
    const value = Number(query.graduationYear);
    if (!Number.isInteger(value) || value < 1900 || value > 3000) return { error: "graduationYear must be a valid year" };
    return { value };
}

function addGraduationFilter(pipeline, year) {
    if (year === undefined) return pipeline;
    pipeline.push(
        { $lookup: { from: Student.collection.name, localField: "student", foreignField: "_id", as: "studentRecord" } },
        { $unwind: "$studentRecord" },
        { $match: { "studentRecord.graduationYear": year } },
    );
    return pipeline;
}

function parsePagination(query, defaultLimit = 10, maxLimit = 100) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? defaultLimit);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > maxLimit) return { error: `page must be positive and limit must be between 1 and ${maxLimit}` };
    return { page, limit };
}

function publicStudent(student) {
    const result = Object.fromEntries(studentResponseFields.filter((field) => student[field] !== undefined).map((field) => [field, student[field]]));
    result.isActive = student.isActive !== false;
    return result;
}

export async function getDashboardOverview(req, res) {
    try {
        const now = new Date();
        const [totalStudents, activeStudents, totalCompanies, totalDrives, driveGroups, appGroups] = await Promise.all([
            Student.countDocuments({}),
            Student.countDocuments({ isActive: { $ne: false } }),
            Company.countDocuments({}),
            Drive.countDocuments({}),
            Drive.aggregate([
                { $facet: {
                    byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                    upcoming: [
                        { $match: { status: "Published", driveDate: { $gte: now }, applicationDeadline: { $gt: now } } },
                        { $lookup: { from: Company.collection.name, localField: "company", foreignField: "_id", as: "companyRecord" } },
                        { $unwind: "$companyRecord" },
                        { $match: { "companyRecord.isActive": true } },
                        { $count: "count" },
                    ],
                    activePublished: [
                        { $match: { status: "Published", applicationDeadline: { $gt: now } } },
                        { $count: "count" },
                    ],
                } },
            ]),
            Application.aggregate([
                { $group: { _id: "$status", applications: { $sum: 1 }, students: { $addToSet: "$student" } } },
            ]),
        ]);
        const driveCounts = Object.fromEntries((driveGroups[0]?.byStatus ?? []).map(({ _id, count }) => [_id, count]));
        const appCounts = Object.fromEntries((appGroups ?? []).map(({ _id, applications, students }) => [_id, { applications, students: students.length }]));
        const totalApplications = Object.values(appCounts).reduce((sum, row) => sum + row.applications, 0);
        const selectedApplications = appCounts.Selected?.applications ?? 0;
        const selectedStudents = appCounts.Selected?.students ?? 0;
        const shortlistedStudents = appCounts.Shortlisted?.students ?? 0;
        return res.status(200).json({
            students: { total: totalStudents, active: activeStudents },
            companies: { total: totalCompanies },
            drives: {
                total: totalDrives,
                published: driveCounts.Published ?? 0,
                activePublished: driveGroups[0]?.activePublished?.[0]?.count ?? 0,
                closed: driveCounts.Closed ?? 0,
                upcoming: driveGroups[0]?.upcoming?.[0]?.count ?? 0,
            },
            applications: {
                total: totalApplications,
                awaitingReview: appCounts.Applied?.applications ?? 0,
                shortlistedStudents,
                selectedStudents,
                rejected: appCounts.Rejected?.applications ?? 0,
                applicationSelectionRate: totalApplications ? Number(((selectedApplications / totalApplications) * 100).toFixed(2)) : 0,
                applicationSelectionRateDefinition: "Selected applications divided by all applications, as a percentage; this is not a graduating-class placement rate.",
                placementPercentage: totalStudents ? Number(((selectedStudents / totalStudents) * 100).toFixed(2)) : 0,
                placementPercentageNumerator: selectedStudents,
                placementPercentageDenominator: totalStudents,
                placementPercentageDefinition: "Unique students with at least one currently Selected application divided by all registered student records, as a percentage. This is an institution-wide snapshot, not a graduating-class rate.",
                byStatus: applicationStatuses.map((status) => ({ status, count: appCounts[status]?.applications ?? 0 })),
            },
        });
    } catch (error) { return handleError(res, error, "retrieving dashboard overview"); }
}

export async function getApplicationAnalytics(req, res) {
    const range = dateRange(req.query);
    if (range.error) return res.status(400).json({ message: range.error });
    const year = graduationYear(req.query);
    if (year.error) return res.status(400).json({ message: year.error });
    const granularity = String(req.query.granularity ?? "month");
    const formats = { day: "%Y-%m-%d", month: "%Y-%m", year: "%Y" };
    if (!Object.hasOwn(formats, granularity)) return res.status(400).json({ message: "granularity must be day, month, or year" });
    const match = range.match.appliedAt ? { appliedAt: range.match.appliedAt } : {};
    try {
        const statusPipeline = addGraduationFilter([{ $match: match }], year.value);
        statusPipeline.push({ $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } });
        const timelinePipeline = addGraduationFilter([{ $match: match }], year.value);
        timelinePipeline.push(
            { $group: { _id: { $dateToString: { format: formats[granularity], date: "$appliedAt", timezone: "UTC" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } },
        );
        const [byStatus, overTime] = await Promise.all([Application.aggregate(statusPipeline), Application.aggregate(timelinePipeline)]);
        const counts = Object.fromEntries(byStatus.map(({ _id, count }) => [_id, count]));
        return res.status(200).json({
            filters: { ...(range.start ? { startDate: range.start } : {}), ...(range.end ? { endDate: range.end } : {}), ...(year.value ? { graduationYear: year.value } : {}), granularity },
            applicationsByStatus: applicationStatuses.map((status) => ({ status, count: counts[status] ?? 0 })),
            applicationsOverTime: overTime.map(({ _id, count }) => ({ period: _id, count })),
        });
    } catch (error) { return handleError(res, error, "retrieving application analytics"); }
}

function applicationCompanyPipeline({ match = {}, graduationYear: year, selectedOnly = false, limit = 20, companyId } = {}) {
    const pipeline = [{ $match: { ...match, ...(selectedOnly ? { status: "Selected" } : {}) } }];
    if (year !== undefined) addGraduationFilter(pipeline, year);
    pipeline.push(
        { $lookup: { from: Drive.collection.name, localField: "drive", foreignField: "_id", as: "driveRecord" } },
        { $unwind: "$driveRecord" },
    );
    if (companyId) pipeline.push({ $match: { "driveRecord.company": new mongoose.Types.ObjectId(String(companyId)) } });
    pipeline.push(
        { $group: {
            _id: "$driveRecord.company",
            applicationCount: { $sum: 1 },
            selectedApplicationCount: { $sum: { $cond: [{ $eq: ["$status", "Selected"] }, 1, 0] } },
            selectedStudents: { $addToSet: { $cond: [{ $eq: ["$status", "Selected"] }, "$student", null] } },
        } },
        { $lookup: { from: Company.collection.name, localField: "_id", foreignField: "_id", as: "companyRecord" } },
        { $unwind: "$companyRecord" },
        { $match: { "companyRecord.isActive": true } },
        { $project: {
            _id: 0,
            company: { id: "$companyRecord._id", name: { $ifNull: ["$companyRecord.name", "$companyRecord.companyName"] } },
            applicationCount: 1,
            selectedApplicationCount: 1,
            selectedStudentCount: { $size: { $filter: { input: "$selectedStudents", as: "studentId", cond: { $ne: ["$$studentId", null] } } } },
        } },
        { $sort: { ...(selectedOnly ? { selectedStudentCount: -1 } : { applicationCount: -1 }), "company.name": 1 } },
        { $limit: limit },
    );
    return pipeline;
}

function analyticsFilters(req, { allowCompany = false } = {}) {
    const range = dateRange(req.query);
    if (range.error) return { error: range.error };
    const year = graduationYear(req.query);
    if (year.error) return { error: year.error };
    if (allowCompany && req.query.company && !validId(String(req.query.company))) return { error: "Invalid company ID" };
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) return { error: "limit must be between 1 and 100" };
    return { range, graduationYear: year.value, limit };
}

export async function getPlacementAnalytics(req, res) {
    const filters = analyticsFilters(req);
    if (filters.error) return res.status(400).json({ message: filters.error });
    const match = filters.range.match.appliedAt ? { appliedAt: filters.range.match.appliedAt } : {};
    try {
        const selectedStudentsByCompany = await Application.aggregate(applicationCompanyPipeline({ match, graduationYear: filters.graduationYear, selectedOnly: true, limit: filters.limit }));
        return res.status(200).json({
            filters: { ...(filters.range.start ? { startDate: filters.range.start } : {}), ...(filters.range.end ? { endDate: filters.range.end } : {}), ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}) },
            selectedStudentsByCompany,
        });
    } catch (error) { return handleError(res, error, "retrieving placement analytics"); }
}

export async function getCompanyAnalytics(req, res) {
    const filters = analyticsFilters(req, { allowCompany: true });
    if (filters.error) return res.status(400).json({ message: filters.error });
    const match = filters.range.match.appliedAt ? { appliedAt: filters.range.match.appliedAt } : {};
    try {
        const pipeline = applicationCompanyPipeline({ match, graduationYear: filters.graduationYear, limit: filters.limit, companyId: req.query.company });
        const topCompanies = await Application.aggregate(pipeline);
        return res.status(200).json({
            filters: { ...(filters.range.start ? { startDate: filters.range.start } : {}), ...(filters.range.end ? { endDate: filters.range.end } : {}), ...(filters.graduationYear ? { graduationYear: filters.graduationYear } : {}) },
            topCompaniesByApplicationCount: topCompanies,
        });
    } catch (error) { return handleError(res, error, "retrieving company analytics"); }
}

export async function getDriveAnalytics(req, res) {
    const range = dateRange({ startDate: req.query.startDate, endDate: req.query.endDate });
    if (range.error) return res.status(400).json({ message: range.error });
    if (req.query.status && !driveStatuses.includes(String(req.query.status))) return res.status(400).json({ message: "Invalid drive status" });
    const year = graduationYear(req.query);
    if (year.error) return res.status(400).json({ message: year.error });
    const match = {};
    if (range.start || range.end) match.createdAt = { ...(range.start ? { $gte: range.start } : {}), ...(range.end ? { $lte: range.end } : {}) };
    if (req.query.status) match.status = String(req.query.status);
    if (year.value) match["eligibility.graduationYear"] = year.value;
    try {
        const byStatus = await Drive.aggregate([{ $match: match }, { $group: { _id: "$status", count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
        const counts = Object.fromEntries(byStatus.map(({ _id, count }) => [_id, count]));
        return res.status(200).json({
            filters: { ...(range.start ? { startDate: range.start } : {}), ...(range.end ? { endDate: range.end } : {}), ...(year.value ? { graduationYear: year.value } : {}) },
            drivesByStatus: driveStatuses.map((status) => ({ status, count: counts[status] ?? 0 })),
        });
    } catch (error) { return handleError(res, error, "retrieving drive analytics"); }
}

export async function getAdminStudents(req, res) {
    const pagination = parsePagination(req.query);
    if (pagination.error) return res.status(400).json({ message: pagination.error });
    const filter = {};
    const clauses = [];
    if (req.query.search !== undefined) {
        if (typeof req.query.search !== "string" || req.query.search.trim().length > 100) return res.status(400).json({ message: "search must be at most 100 characters" });
        const term = escapeRegex(req.query.search.trim());
        if (term) clauses.push({ $or: ["name", "email"].map((field) => ({ [field]: { $regex: term, $options: "i" } })) });
    }
    if (req.query.branch !== undefined) {
        if (typeof req.query.branch !== "string" || !req.query.branch.trim() || req.query.branch.length > 100) return res.status(400).json({ message: "Invalid branch filter" });
        const branch = { $regex: `^${escapeRegex(req.query.branch.trim())}$`, $options: "i" };
        clauses.push({ $or: [{ department: branch }, { course: branch }] });
    }
    if (req.query.graduationYear !== undefined) {
        const year = Number(req.query.graduationYear);
        if (!Number.isInteger(year) || year < 1900 || year > 3000) return res.status(400).json({ message: "graduationYear must be a valid year" });
        filter.graduationYear = year;
    }
    if (req.query.status !== undefined) {
        if (!["active", "inactive"].includes(String(req.query.status))) return res.status(400).json({ message: "status must be active or inactive" });
        filter.isActive = req.query.status === "active" ? { $ne: false } : false;
    }
    if (clauses.length === 1) Object.assign(filter, clauses[0]);
    if (clauses.length > 1) filter.$and = clauses;
    try {
        const [students, total] = await Promise.all([
            Student.find(filter).select(studentProjection).sort({ createdAt: -1 }).skip((pagination.page - 1) * pagination.limit).limit(pagination.limit).lean(),
            Student.countDocuments(filter),
        ]);
        return res.status(200).json({
            students: students.map(publicStudent),
            pagination: { ...pagination, total, pages: Math.ceil(total / pagination.limit) },
        });
    } catch (error) { return handleError(res, error, "listing students"); }
}

export async function getAdminStudentById(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid student ID" });
    try {
        const student = await Student.findById(req.params.id).select(studentProjection).lean();
        if (!student) return res.status(404).json({ message: "Student not found" });
        return res.status(200).json({ student: publicStudent(student) });
    } catch (error) { return handleError(res, error, "retrieving student"); }
}

export async function updateAdminStudentStatus(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid student ID" });
    if (!req.body || typeof req.body.isActive !== "boolean" || Object.keys(req.body).some((key) => key !== "isActive")) return res.status(400).json({ message: "Only a boolean isActive value may be updated" });
    try {
        const student = await Student.findByIdAndUpdate(req.params.id, { $set: { isActive: req.body.isActive } }, { returnDocument: "after", runValidators: true }).select(studentProjection).lean();
        if (!student) return res.status(404).json({ message: "Student not found" });
        return res.status(200).json({ message: `Student account ${req.body.isActive ? "enabled" : "disabled"}`, student: publicStudent(student) });
    } catch (error) { return handleError(res, error, "updating student status"); }
}
