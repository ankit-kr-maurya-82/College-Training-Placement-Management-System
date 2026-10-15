import mongoose from "mongoose";
import { Company } from "../models/company.model.js";
import { Drive } from "../models/drive.model.js";

const driveFields = ["title", "company", "description", "jobType", "location", "workMode", "ctc", "eligibility", "requiredSkills", "applicationDeadline", "driveDate", "openings"];
const jobTypes = new Set(["Full-time", "Internship", "Part-time"]);
const workModes = new Set(["On-site", "Hybrid", "Remote"]);
const validId = (value) => /^[a-f\d]{24}$/i.test(value ?? "");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function validateDriveInput(body, { partial = false } = {}) {
    const input = {};
    for (const field of driveFields) if (Object.hasOwn(body, field)) input[field] = body[field];
    const required = ["title", "company", "description", "jobType", "location", "workMode", "applicationDeadline"];
    for (const field of required) {
        if ((!partial || Object.hasOwn(input, field)) && (input[field] === undefined || input[field] === null || input[field] === "")) {
            return { error: `${field} is required` };
        }
    }
    for (const field of ["title", "description", "location", "ctc"]) {
        if (Object.hasOwn(input, field)) {
            if (typeof input[field] !== "string" || !input[field].trim()) return { error: `${field} must be a non-empty string` };
            input[field] = input[field].trim();
        }
    }
    if (Object.hasOwn(input, "company") && (typeof input.company !== "string" || !validId(input.company))) return { error: "Invalid company ID" };
    if (Object.hasOwn(input, "jobType") && !jobTypes.has(input.jobType)) return { error: "Invalid jobType" };
    if (Object.hasOwn(input, "workMode") && !workModes.has(input.workMode)) return { error: "Invalid workMode" };
    for (const field of ["applicationDeadline", "driveDate"]) {
        if (Object.hasOwn(input, field)) {
            const value = new Date(input[field]);
            if (Number.isNaN(value.getTime())) return { error: `${field} must be a valid date` };
            input[field] = value;
        }
    }
    if (Object.hasOwn(input, "openings") && (!Number.isInteger(input.openings) || input.openings < 1)) return { error: "openings must be a positive whole number" };
    if (Object.hasOwn(input, "requiredSkills")) {
        if (!Array.isArray(input.requiredSkills) || input.requiredSkills.some((skill) => typeof skill !== "string" || !skill.trim())) return { error: "requiredSkills must be an array of non-empty strings" };
        input.requiredSkills = input.requiredSkills.map((skill) => skill.trim());
    }
    if (Object.hasOwn(input, "eligibility")) {
        const rules = input.eligibility;
        const allowed = ["minCGPA", "allowedBranches", "graduationYear", "maxBacklogs"];
        if (!rules || typeof rules !== "object" || Array.isArray(rules) || Object.keys(rules).some((key) => !allowed.includes(key))) return { error: "Invalid eligibility" };
        if (Object.hasOwn(rules, "minCGPA") && (typeof rules.minCGPA !== "number" || rules.minCGPA < 0 || rules.minCGPA > 10)) return { error: "eligibility.minCGPA must be between 0 and 10" };
        if (Object.hasOwn(rules, "graduationYear") && (!Number.isInteger(rules.graduationYear) || rules.graduationYear < 1900)) return { error: "eligibility.graduationYear must be a valid year" };
        if (Object.hasOwn(rules, "maxBacklogs") && (!Number.isInteger(rules.maxBacklogs) || rules.maxBacklogs < 0)) return { error: "eligibility.maxBacklogs must be a non-negative whole number" };
        if (Object.hasOwn(rules, "allowedBranches")) {
            if (!Array.isArray(rules.allowedBranches) || rules.allowedBranches.some((branch) => typeof branch !== "string" || !branch.trim())) return { error: "eligibility.allowedBranches must be an array of non-empty strings" };
            rules.allowedBranches = rules.allowedBranches.map((branch) => branch.trim());
        }
        input.eligibility = rules;
    }
    if (!Object.keys(input).length) return { error: "At least one drive field is required" };
    return { input };
}

function getCreatorId(user) {
    const id = user?.userId ?? user?._id ?? user?.sub;
    return typeof id === "string" && validId(id) ? id : null;
}

function isCompanyUser(user) { return String(user?.role ?? "").toUpperCase() === "COMPANY"; }
function ownsDrive(drive, user) { return !isCompanyUser(user) || String(drive.company) === String(user.companyId); }

function handleError(res, err, operation) {
    if (err?.name === "ValidationError" || err?.name === "CastError") return res.status(400).json({ message: "Invalid drive data" });
    console.error(`Error ${operation} drive:`, err);
    return res.status(500).json({ message: "Internal server error" });
}

export async function createDrive(req, res) {
    const companyUser = isCompanyUser(req.user);
    const { input, error } = validateDriveInput(companyUser ? { ...(req.body ?? {}), company: req.user.companyId } : (req.body ?? {}));
    if (error) return res.status(400).json({ message: error });
    if (companyUser) input.company = req.user.companyId;
    const createdBy = companyUser ? null : getCreatorId(req.user);
    if (!companyUser && !createdBy) return res.status(401).json({ message: "Authenticated user identity is required" });
    try {
        const company = await Company.findOne({ _id: input.company, isActive: true });
        if (!company) return res.status(400).json({ message: "Company not found or inactive" });
        const drive = await Drive.create({ ...input, ...(createdBy ? { createdBy } : { createdByCompany: input.company }), status: "Draft" });
        return res.status(201).json({ message: "Drive created successfully", drive });
    } catch (err) { return handleError(res, err, "creating"); }
}

export async function getDrives(req, res) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ message: "page must be positive and limit must be between 1 and 100" });
    if (req.query.company && !validId(String(req.query.company))) return res.status(400).json({ message: "Invalid company ID" });
    try {
        const activeCompanies = await Company.find({ isActive: true }).select("_id").lean();
        const filter = { status: "Published", applicationDeadline: { $gt: new Date() }, company: { $in: activeCompanies.map((company) => company._id) } };
        if (req.query.company) filter.company = { $in: activeCompanies.filter((company) => String(company._id) === String(req.query.company)).map((company) => company._id) };
        for (const field of ["location", "jobType", "workMode"]) if (req.query[field]) filter[field] = field === "location" ? { $regex: escapeRegex(String(req.query[field])), $options: "i" } : String(req.query[field]);
        if (filter.jobType && !jobTypes.has(filter.jobType)) return res.status(400).json({ message: "Invalid jobType" });
        if (filter.workMode && !workModes.has(filter.workMode)) return res.status(400).json({ message: "Invalid workMode" });
        if (req.query.search) {
            const search = escapeRegex(String(req.query.search));
            filter.$or = ["title", "description", "location"].map((field) => ({ [field]: { $regex: search, $options: "i" } }));
        }
        const [drives, total] = await Promise.all([
            Drive.find(filter).populate("company", "name companyName logo location").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Drive.countDocuments(filter),
        ]);
        return res.status(200).json({ drives, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) { return handleError(res, err, "retrieving"); }
}

// Manager-only inventory includes drafts and closed drives; public GET / remains active-only.
export async function getManageDrives(req, res) {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "page must be positive and limit must be between 1 and 100" });
    }
    try {
        const filter = isCompanyUser(req.user) ? { company: req.user.companyId } : {};
        const [drives, total] = await Promise.all([
            Drive.find(filter).populate("company", "name companyName logo location").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Drive.countDocuments(filter),
        ]);
        return res.status(200).json({ drives, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) { return handleError(res, err, "retrieving manager drive inventory"); }
}

export async function getDriveById(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    try {
        const activeCompanies = await Company.find({ isActive: true }).select("_id").lean();
        const drive = await Drive.findOne({ _id: req.params.id, status: "Published", applicationDeadline: { $gt: new Date() }, company: { $in: activeCompanies.map((company) => company._id) } }).populate("company", "name companyName logo location").lean();
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        return res.status(200).json({ drive });
    } catch (err) { return handleError(res, err, "retrieving"); }
}

export async function updateDrive(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    const { input, error } = validateDriveInput(req.body ?? {}, { partial: true });
    if (error) return res.status(400).json({ message: error });
    try {
        const drive = await Drive.findById(req.params.id);
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        if (!ownsDrive(drive, req.user)) return res.status(403).json({ message: "You cannot manage this drive" });
        if (!["Draft", "Published"].includes(drive.status)) return res.status(409).json({ message: "This drive can no longer be updated" });
        if (isCompanyUser(req.user) && input.company && String(input.company) !== String(req.user.companyId)) return res.status(403).json({ message: "You cannot change the drive company" });
        if (input.company && !await Company.findOne({ _id: input.company, isActive: true })) return res.status(400).json({ message: "Company not found or inactive" });
        Object.assign(drive, input);
        await drive.save();
        return res.status(200).json({ message: "Drive updated successfully", drive });
    } catch (err) { return handleError(res, err, "updating"); }
}

export async function publishDrive(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    try {
        const drive = await Drive.findById(req.params.id);
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        if (!ownsDrive(drive, req.user)) return res.status(403).json({ message: "You cannot manage this drive" });
        if (drive.status !== "Draft") return res.status(409).json({ message: "Only draft drives can be published" });
        if (drive.applicationDeadline <= new Date()) return res.status(400).json({ message: "Application deadline must be in the future" });
        const company = await Company.findOne({ _id: drive.company, isActive: true });
        if (!company) return res.status(400).json({ message: "Company not found or inactive" });
        drive.status = "Published";
        await drive.save();
        return res.status(200).json({ message: "Drive published successfully", drive });
    } catch (err) { return handleError(res, err, "publishing"); }
}

export async function closeDrive(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    try {
        const drive = await Drive.findById(req.params.id);
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        if (!ownsDrive(drive, req.user)) return res.status(403).json({ message: "You cannot manage this drive" });
        if (drive.status !== "Published") return res.status(409).json({ message: "Only published drives can be closed" });
        drive.status = "Closed";
        await drive.save();
        return res.status(200).json({ message: "Drive closed successfully", drive });
    } catch (err) { return handleError(res, err, "closing"); }
}

export async function deleteDrive(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    try {
        const existing = await Drive.findById(req.params.id);
        if (!existing) return res.status(404).json({ message: "Drive not found" });
        if (!ownsDrive(existing, req.user)) return res.status(403).json({ message: "You cannot manage this drive" });
        const drive = await Drive.findByIdAndDelete(req.params.id);
        return res.status(200).json({ message: "Drive deleted successfully" });
    } catch (err) { return handleError(res, err, "deleting"); }
}
