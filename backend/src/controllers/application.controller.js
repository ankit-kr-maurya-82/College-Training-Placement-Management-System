import { Application } from "../models/application.model.js";
import { Company } from "../models/company.model.js";
import { Drive } from "../models/drive.model.js";
import { Student } from "../models/student.model.js";
import mongoose from "mongoose";

const statuses = ["Applied", "Under Review", "Shortlisted", "Interview Scheduled", "Selected", "Rejected", "Withdrawn"];
const managerStatuses = new Set(["Under Review", "Shortlisted", "Interview Scheduled", "Selected", "Rejected"]);
const validId = (value) => /^[a-f\d]{24}$/i.test(value ?? "");
const transitions = {
    Applied: new Set(["Under Review", "Shortlisted", "Rejected", "Withdrawn"]),
    "Under Review": new Set(["Shortlisted", "Interview Scheduled", "Rejected", "Withdrawn"]),
    Shortlisted: new Set(["Interview Scheduled", "Selected", "Rejected", "Withdrawn"]),
    "Interview Scheduled": new Set(["Selected", "Rejected", "Withdrawn"]),
    Selected: new Set(),
    Rejected: new Set(),
    Withdrawn: new Set(),
};
const drivePopulation = {
    path: "drive",
    select: "title description location jobType workMode ctc driveDate applicationDeadline openings requiredSkills eligibility company",
    populate: { path: "company", select: "name companyName logo" },
};
const studentPopulation = { path: "student", select: "name department course" };

function studentIdFrom(user) {
    const id = user?.studentId;
    return typeof id === "string" && validId(id) ? id : null;
}

function managerIdFrom(user) {
    const id = user?.userId ?? user?._id ?? user?.sub;
    return typeof id === "string" && validId(id) ? id : null;
}

function isManager(user) {
    return ["ADMIN", "TPO"].includes(String(user?.role ?? "").toUpperCase());
}
function isCompany(user) { return String(user?.role ?? "").toUpperCase() === "COMPANY" && validId(user?.companyId); }

function safeError(res, error, operation) {
    if (error?.code === 11000) return res.status(409).json({ message: "You have already applied to this drive" });
    if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: "Invalid application data" });
    console.error(`Error ${operation} application:`, error);
    return res.status(500).json({ message: "Internal server error" });
}

function validResumeUrl(value) {
    if (typeof value !== "string" || !value.trim()) return false;
    try {
        const url = new URL(value.trim());
        return url.protocol === "https:" || url.protocol === "http:";
    } catch { return false; }
}

function checkEligibility(student, eligibility = {}) {
    if (eligibility.minCGPA !== undefined && (typeof student.cgpa !== "number" || student.cgpa < eligibility.minCGPA)) return "You do not meet the minimum CGPA requirement";
    if (eligibility.allowedBranches?.length) {
        const studentBranches = [student.department, student.course].filter(Boolean).map((value) => value.trim().toLowerCase());
        if (!studentBranches.length || !eligibility.allowedBranches.some((branch) => studentBranches.includes(branch.trim().toLowerCase()))) return "Your branch is not eligible for this drive";
    }
    if (eligibility.graduationYear !== undefined && student.graduationYear !== eligibility.graduationYear) return "Your graduation year is not eligible for this drive";
    if (eligibility.maxBacklogs !== undefined && (typeof student.activeBacklogs !== "number" || student.activeBacklogs > eligibility.maxBacklogs)) return "You do not meet the backlog requirement";
    return null;
}

export async function applyForDrive(req, res) {
    const studentId = studentIdFrom(req.user);
    if (!studentId) return res.status(403).json({ message: "A student account is required" });
    const { driveId, resumeUrl, coverLetter } = req.body ?? {};
    if (typeof driveId !== "string" || !validId(driveId)) return res.status(400).json({ message: "A valid driveId is required" });
    if (resumeUrl !== undefined && !validResumeUrl(resumeUrl)) return res.status(400).json({ message: "resumeUrl must be a valid HTTP(S) URL" });
    if (coverLetter !== undefined && (typeof coverLetter !== "string" || coverLetter.length > 10000)) return res.status(400).json({ message: "coverLetter must be a string of at most 10000 characters" });
    try {
        const [student, drive] = await Promise.all([req.studentAccount ?? Student.findById(studentId), Drive.findById(driveId)]);
        if (!student) return res.status(404).json({ message: "Student not found" });
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        if (drive.status !== "Published") return res.status(409).json({ message: "This drive is not accepting applications" });
        if (!(drive.applicationDeadline > new Date())) return res.status(409).json({ message: "The application deadline has passed" });
        const company = await Company.findById(drive.company);
        if (!company || company.isActive !== true) return res.status(409).json({ message: "This drive is not accepting applications" });
        const eligibilityError = checkEligibility(student, drive.eligibility);
        if (eligibilityError) return res.status(403).json({ message: eligibilityError });
        const selectedResume = resumeUrl === undefined ? student.resumeUrl : resumeUrl.trim();
        if (!validResumeUrl(selectedResume)) return res.status(400).json({ message: "A valid resumeUrl is required" });
        const application = await Application.create({
            student: student._id,
            drive: drive._id,
            resumeUrl: selectedResume,
            ...(coverLetter === undefined ? {} : { coverLetter: coverLetter.trim() }),
            status: "Applied",
            appliedAt: new Date(),
            statusHistory: [{ status: "Applied", changedBy: student._id, changedAt: new Date() }],
        });
        return res.status(201).json({ message: "Application submitted successfully", application });
    } catch (error) { return safeError(res, error, "submitting"); }
}

export async function getMyApplications(req, res) {
    const studentId = studentIdFrom(req.user);
    if (!studentId) return res.status(403).json({ message: "A student account is required" });
    const filter = { student: studentId };
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search.length > 100) return res.status(400).json({ message: "Search must be 100 characters or fewer" });
    if (search) {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const expression = new RegExp(escapedSearch, "i");
        try {
            const matchingCompanies = await Company.find({ $or: [{ name: expression }, { companyName: expression }] }).select("_id").lean();
            const matchingDrives = await Drive.find({
                $or: [{ title: expression }, { company: { $in: matchingCompanies.map(({ _id }) => _id) } }],
            }).select("_id").lean();
            filter.drive = { $in: matchingDrives.map(({ _id }) => _id) };
        } catch (error) { return safeError(res, error, "searching"); }
    }
    const dateRange = {};
    for (const key of ["from", "to"]) {
        const value = req.query[key];
        if (value === undefined || value === "") continue;
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return res.status(400).json({ message: `Invalid ${key} application date` });
        }
        const parsed = new Date(`${value}T00:00:00.000Z`);
        if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
            return res.status(400).json({ message: `Invalid ${key} application date` });
        }
        if (key === "from") dateRange.$gte = parsed;
        else {
            parsed.setUTCDate(parsed.getUTCDate() + 1);
            dateRange.$lt = parsed;
        }
    }
    if (dateRange.$gte && dateRange.$lt && dateRange.$gte >= dateRange.$lt) {
        return res.status(400).json({ message: "The start date must not be after the end date" });
    }
    if (Object.keys(dateRange).length) filter.appliedAt = dateRange;
    return listApplications(req, res, filter, { studentId });
}

export async function getApplications(req, res) {
    const filter = {};
    try {
        if (isCompany(req.user)) {
            const ownDrives = await Drive.find({ company: req.user.companyId }).select("_id").lean();
            filter.drive = { $in: ownDrives.map(({ _id }) => _id) };
        }
        if (req.query.status) {
            if (!statuses.includes(String(req.query.status))) return res.status(400).json({ message: "Invalid application status" });
            filter.status = String(req.query.status);
        }
        for (const key of ["student", "drive"]) {
            if (req.query[key]) {
                if (!validId(String(req.query[key]))) return res.status(400).json({ message: `Invalid ${key} ID` });
                if (key === "drive" && isCompany(req.user)) {
                    if (!filter.drive.$in.some((id) => String(id) === String(req.query[key]))) return res.status(403).json({ message: "You cannot access applications for this drive" });
                    filter.drive = String(req.query[key]);
                } else filter[key] = String(req.query[key]);
            }
        }
    } catch (error) {
        return safeError(res, error, "listing");
    }
    return listApplications(req, res, filter);
}

async function listApplications(req, res, filter, { studentId } = {}) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ message: "page must be positive and limit must be between 1 and 100" });
    if (req.query.status && !statuses.includes(String(req.query.status))) return res.status(400).json({ message: "Invalid application status" });
    if (req.query.status) filter.status = String(req.query.status);
    try {
        const [applications, total, statusGroups] = await Promise.all([
            Application.find(filter).sort({ appliedAt: -1 }).skip((page - 1) * limit).limit(limit).populate(drivePopulation).populate(studentPopulation).lean(),
            Application.countDocuments(filter),
            studentId
                ? Application.aggregate([
                    { $match: { student: new mongoose.Types.ObjectId(studentId) } },
                    { $group: { _id: "$status", count: { $sum: 1 } } },
                ])
                : Promise.resolve(null),
        ]);
        const response = { applications, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
        if (statusGroups) {
            const counts = Object.fromEntries(statusGroups.map(({ _id, count }) => [_id, count]));
            response.summary = {
                total: statusGroups.reduce((sum, group) => sum + group.count, 0),
                pending: ["Applied", "Under Review", "Interview Scheduled"].reduce((sum, status) => sum + (counts[status] ?? 0), 0),
                shortlisted: counts.Shortlisted ?? 0,
                selected: counts.Selected ?? 0,
                rejected: counts.Rejected ?? 0,
            };
        }
        return res.status(200).json(response);
    } catch (error) { return safeError(res, error, "listing"); }
}

export async function getApplicationById(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid application ID" });
    const studentId = studentIdFrom(req.user);
    const manager = isManager(req.user);
    const companyUser = isCompany(req.user);
    if (!studentId && !manager && !companyUser) return res.status(403).json({ message: "An authorized account is required" });
    try {
        const application = await Application.findById(req.params.id).populate(drivePopulation).populate(studentPopulation).lean();
        if (!application) return res.status(404).json({ message: "Application not found" });
        if (!manager && !companyUser && String(application.student?._id ?? application.student) !== studentId) return res.status(403).json({ message: "You cannot access this application" });
        if (companyUser && String(application.drive?.company?._id ?? application.drive?.company) !== req.user.companyId) return res.status(403).json({ message: "You cannot access this application" });
        return res.status(200).json({ application });
    } catch (error) { return safeError(res, error, "retrieving"); }
}

export async function withdrawApplication(req, res) {
    const studentId = studentIdFrom(req.user);
    if (!studentId) return res.status(403).json({ message: "A student account is required" });
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid application ID" });
    if (req.body?.note !== undefined && (typeof req.body.note !== "string" || req.body.note.length > 2000)) return res.status(400).json({ message: "note must be a string of at most 2000 characters" });
    try {
        const application = await Application.findById(req.params.id);
        if (!application) return res.status(404).json({ message: "Application not found" });
        if (String(application.student) !== studentId) return res.status(403).json({ message: "You cannot withdraw this application" });
        if (!transitions[application.status]?.has("Withdrawn")) return res.status(409).json({ message: `An application with status ${application.status} cannot be withdrawn` });
        application.status = "Withdrawn";
        application.statusHistory.push({ status: "Withdrawn", changedBy: studentId, changedAt: new Date(), ...(req.body?.note?.trim() ? { note: req.body.note.trim() } : {}) });
        await application.save();
        return res.status(200).json({ message: "Application withdrawn successfully", application });
    } catch (error) { return safeError(res, error, "withdrawing"); }
}

export async function updateApplicationStatus(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid application ID" });
    const { status, note } = req.body ?? {};
    if (!managerStatuses.has(status)) return res.status(400).json({ message: "Invalid application status" });
    if (note !== undefined && (typeof note !== "string" || note.length > 2000)) return res.status(400).json({ message: "note must be a string of at most 2000 characters" });
    const companyUser = isCompany(req.user);
    const changedBy = companyUser ? req.user.companyId : managerIdFrom(req.user);
    if (!changedBy) return res.status(401).json({ message: "Authenticated user identity is required" });
    try {
        const application = await Application.findById(req.params.id);
        if (!application) return res.status(404).json({ message: "Application not found" });
        if (companyUser) {
            const drive = await Drive.findById(application.drive).select("company").lean();
            if (!drive || String(drive.company) !== req.user.companyId) return res.status(403).json({ message: "You cannot manage this application" });
        }
        if (!transitions[application.status]?.has(status)) return res.status(409).json({ message: `Cannot change application status from ${application.status} to ${status}` });
        application.status = status;
        application.statusHistory.push({ status, changedBy, changedAt: new Date(), ...(note?.trim() ? { note: note.trim() } : {}) });
        await application.save();
        return res.status(200).json({ message: "Application status updated successfully", application });
    } catch (error) { return safeError(res, error, "updating status for"); }
}
