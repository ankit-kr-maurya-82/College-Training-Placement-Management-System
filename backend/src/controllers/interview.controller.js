import mongoose from "mongoose";
import { Application } from "../models/application.model.js";
import { Interview } from "../models/interview.model.js";
import { sendInterviewEmail } from "../services/vacancy-email.service.js";

const statuses = new Set(["SCHEDULED", "COMPLETED", "CANCELLED"]);
const modes = new Set(["ONLINE", "OFFLINE", "PHONE"]);
const schedulableApplicationStatuses = new Set(["Applied", "Under Review", "Shortlisted", "Interview Scheduled"]);
const validId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const identity = (req, type) => type === "COMPANY" ? req.user?.companyId : req.user?.studentId;

function requestKey(req, res) {
    const key = req.get?.("idempotency-key") ?? req.headers?.["idempotency-key"];
    if (typeof key !== "string" || !/^[a-zA-Z0-9._:-]{8,128}$/.test(key)) {
        res.status(400).json({ message: "A valid Idempotency-Key header is required" });
        return null;
    }
    return key;
}

function parseSchedule(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Interview details are required" };
    if (typeof body.startAt !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(body.startAt)) return { error: "startAt must be an ISO date-time with a timezone" };
    if (typeof body.endAt !== "string" || !/(?:Z|[+-]\d{2}:\d{2})$/i.test(body.endAt)) return { error: "endAt must be an ISO date-time with a timezone" };
    const startAt = new Date(body.startAt);
    const endAt = new Date(body.endAt);
    if (Number.isNaN(startAt.getTime())) return { error: "startAt must be a valid date-time" };
    if (Number.isNaN(endAt.getTime())) return { error: "endAt must be a valid date-time" };
    if (startAt <= new Date()) return { error: "Interview start time must be in the future" };
    if (endAt <= startAt) return { error: "endAt must be later than startAt" };
    if (typeof body.timeZone !== "string" || body.timeZone.length > 100) return { error: "A valid IANA timeZone is required" };
    try { new Intl.DateTimeFormat("en", { timeZone: body.timeZone }); }
    catch { return { error: "A valid IANA timeZone is required" }; }
    if (!modes.has(body.mode)) return { error: "mode must be ONLINE, OFFLINE, or PHONE" };
    const meetingLink = typeof body.meetingLink === "string" ? body.meetingLink.trim() : "";
    const venue = typeof body.venue === "string" ? body.venue.trim() : "";
    const instructions = typeof body.instructions === "string" ? body.instructions.trim() : "";
    if (body.instructions !== undefined && (typeof body.instructions !== "string" || body.instructions.length > 4000)) return { error: "instructions must be a string of at most 4000 characters" };
    if (body.mode === "ONLINE") {
        let url;
        try { url = new URL(meetingLink); } catch { url = null; }
        if (!url || url.protocol !== "https:" || !url.hostname || url.username || url.password) return { error: "A valid HTTPS meetingLink is required for online interviews" };
    }
    if (body.mode === "OFFLINE" && (!venue || venue.length > 500)) return { error: "A venue of at most 500 characters is required for offline interviews" };
    return { value: {
        startAt,
        endAt,
        timeZone: body.timeZone,
        mode: body.mode,
        ...(body.mode === "ONLINE" ? { meetingLink } : {}),
        ...(body.mode === "OFFLINE" ? { venue } : {}),
        ...(instructions ? { instructions } : {}),
    } };
}

function eventFor({ requestId, action, changedBy, schedule, notificationStatus = "NOT_REQUIRED", note }) {
    return {
        requestId,
        action,
        changedBy,
        changedAt: new Date(),
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        timeZone: schedule.timeZone,
        mode: schedule.mode,
        ...(schedule.meetingLink ? { meetingLink: schedule.meetingLink } : {}),
        ...(schedule.venue ? { venue: schedule.venue } : {}),
        ...(schedule.instructions ? { instructions: schedule.instructions } : {}),
        ...(note ? { note } : {}),
        notificationStatus,
    };
}

function eventSnapshot(interview) {
    return {
        startAt: interview.startAt,
        endAt: interview.endAt,
        timeZone: interview.timeZone,
        mode: interview.mode,
        meetingLink: interview.meetingLink,
        venue: interview.venue,
        instructions: interview.instructions,
    };
}

async function sendStudentUpdate(interview, event, action) {
    try {
        const claimed = await Interview.updateOne(
            { _id: interview._id, events: { $elemMatch: { requestId: event.requestId, notificationStatus: "PENDING" } } },
            { $set: { "events.$.notificationStatus": "SENDING" } },
        );
        if (!claimed.modifiedCount) return "NOT_SENT";
        await sendInterviewEmail({
            to: interview.student?.email,
            studentName: interview.student?.name,
            companyName: interview.company?.name || interview.company?.companyName || "The company",
            driveTitle: interview.drive?.title || "your application",
            action,
            interview: event,
        });
        await Interview.updateOne(
            { _id: interview._id, events: { $elemMatch: { requestId: event.requestId, notificationStatus: "SENDING" } } },
            { $set: { "events.$.notificationStatus": "SENT" } },
        );
        return "SENT";
    } catch (error) {
        try {
            await Interview.updateOne(
                { _id: interview._id, events: { $elemMatch: { requestId: event.requestId, notificationStatus: { $in: ["PENDING", "SENDING"] } } } },
                { $set: { "events.$.notificationStatus": "FAILED" } },
            );
        } catch { /* the interview update remains successful even if delivery tracking is unavailable */ }
        console.error("Interview notification delivery failed", { errorName: error?.name || "Error", errorCode: typeof error?.code === "string" ? error.code.slice(0, 40) : undefined });
        return "FAILED";
    }
}

function populateInterview(query, { includeStudentEmail = false } = {}) {
    return query
        .populate({ path: "student", select: includeStudentEmail ? "name email department course" : "name department course" })
        .populate({ path: "company", select: "name companyName" })
        .populate({ path: "drive", select: "title location" })
        .populate({ path: "application", select: "status appliedAt" });
}

function publicInterview(value) {
    const interview = typeof value?.toObject === "function" ? value.toObject() : value;
    return {
        ...interview,
        events: (interview.events ?? []).map(({ requestId, notificationStatus, ...event }) => event),
    };
}

async function replayForCompany(companyId, key) {
    return populateInterview(Interview.findOne({ company: companyId, "events.requestId": key })).lean();
}

export async function listCompanyInterviews(req, res) {
    return listInterviews(req, res, "COMPANY");
}

export async function listStudentInterviews(req, res) {
    return listInterviews(req, res, "STUDENT");
}

async function listInterviews(req, res, type) {
    const ownerId = identity(req, type);
    if (!validId(ownerId)) return res.status(403).json({ message: `A ${type.toLowerCase()} account is required` });
    const { status, period = "all" } = req.query;
    if (status && !statuses.has(String(status))) return res.status(400).json({ message: "Invalid interview status" });
    if (!["all", "upcoming", "past"].includes(String(period))) return res.status(400).json({ message: "period must be all, upcoming, or past" });
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ message: "page must be positive and limit must be between 1 and 100" });
    const clauses = [{ [type === "COMPANY" ? "company" : "student"]: ownerId }];
    if (status) clauses.push({ status: String(status) });
    const now = new Date();
    if (period === "upcoming") clauses.push({ status: "SCHEDULED", startAt: { $gt: now } });
    if (period === "past") clauses.push({ $or: [{ startAt: { $lte: now } }, { status: { $in: ["COMPLETED", "CANCELLED"] } }] });
    const filter = clauses.length === 1 ? clauses[0] : { $and: clauses };
    try {
        const [interviews, total] = await Promise.all([
            populateInterview(Interview.find(filter).sort({ startAt: period === "past" ? -1 : 1 }).skip((page - 1) * limit).limit(limit)).lean(),
            Interview.countDocuments(filter),
        ]);
        return res.status(200).json({ interviews: interviews.map(publicInterview), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (error) {
        console.error("Interview list retrieval failed", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Interviews could not be loaded" });
    }
}

const oversightNotificationStatuses = ["NOT_REQUIRED", "PENDING", "SENDING", "SENT", "FAILED"];

function parseOversightDate(value, key) {
    if (typeof value !== "string" || !value.trim()) return { error: `${key} must be a valid date` };
    const input = value.trim();
    let date;
    let dateOnly = false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        date = new Date(`${input}T00:00:00.000Z`);
        dateOnly = true;
        if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== input) return { error: `${key} must be a valid date` };
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(input)) {
        date = new Date(input);
        if (!Number.isFinite(date.getTime())) return { error: `${key} must be a valid date` };
    } else {
        return { error: `${key} must be an ISO date or timezone-qualified date-time` };
    }
    return { date, dateOnly };
}

function oversightFilters(query) {
    const statuses = ["SCHEDULED", "COMPLETED", "CANCELLED"];
    if ((query.page !== undefined && typeof query.page !== "string") || (query.limit !== undefined && typeof query.limit !== "string")) {
        return { error: "page and limit must be numeric values" };
    }
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 20);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return { error: "page must be positive and limit must be between 1 and 100" };
    }
    if (query.status !== undefined && (typeof query.status !== "string" || !statuses.includes(query.status))) return { error: "Invalid interview status" };
    if (query.company !== undefined && !validId(query.company)) return { error: "Invalid company ID" };

    const bounds = {};
    let start;
    let end;
    if (query.startDate !== undefined) {
        const parsed = parseOversightDate(query.startDate, "startDate");
        if (parsed.error) return parsed;
        start = parsed.date;
        bounds.$gte = start;
    }
    if (query.endDate !== undefined) {
        const parsed = parseOversightDate(query.endDate, "endDate");
        if (parsed.error) return parsed;
        end = parsed.dateOnly ? new Date(parsed.date.getTime() + 24 * 60 * 60 * 1000 - 1) : parsed.date;
        bounds.$lte = end;
    }
    if (start && end && start > end) return { error: "startDate must be before or equal to endDate" };
    if (start && end && end - start > 5 * 366 * 24 * 60 * 60 * 1000) return { error: "Date range cannot exceed five years" };

    const filter = {};
    if (Object.keys(bounds).length) filter.startAt = bounds;
    if (query.status !== undefined) filter.status = query.status;
    if (query.company !== undefined) filter.company = new mongoose.Types.ObjectId(query.company);
    return { page, limit, filter, dates: { ...(start ? { startDate: start } : {}), ...(end ? { endDate: end } : {}) } };
}

function publicOversightInterview(interview) {
    const student = interview.student;
    const company = interview.company;
    const drive = interview.drive;
    const application = interview.application;
    return {
        id: String(interview._id),
        startAt: interview.startAt,
        endAt: interview.endAt,
        timeZone: interview.timeZone,
        mode: interview.mode,
        status: interview.status,
        student: student ? {
            name: student.name,
            ...(student.rollNumber ? { rollNumber: student.rollNumber } : {}),
            ...(student.department ? { department: student.department } : {}),
            ...(student.course ? { course: student.course } : {}),
        } : null,
        company: company ? { name: company.name || company.companyName || "Company" } : null,
        drive: drive ? { title: drive.title, ...(drive.location ? { location: drive.location } : {}) } : null,
        application: application ? { status: application.status } : null,
        events: (interview.events ?? []).map((event) => ({
            action: event.action,
            changedAt: event.changedAt,
            ...(event.notificationStatus ? { notificationStatus: event.notificationStatus } : {}),
        })),
    };
}

export async function getInterviewOversight(req, res) {
    const parsed = oversightFilters(req.query ?? {});
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const { page, limit, filter } = parsed;
    try {
        const [rows, total, summary] = await Promise.all([
            Interview.find(filter)
                .select("_id application student company drive startAt endAt timeZone mode status events.action events.changedAt events.notificationStatus")
                .sort({ startAt: 1, _id: 1 })
                .skip((page - 1) * limit)
                .limit(limit)
                .populate({ path: "student", select: "name rollNumber department course" })
                .populate({ path: "company", select: "name companyName" })
                .populate({ path: "drive", select: "title location" })
                .populate({ path: "application", select: "status" })
                .lean(),
            Interview.countDocuments(filter),
            Interview.aggregate([
                { $match: filter },
                { $facet: {
                    byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
                    notificationEvents: [
                        { $unwind: "$events" },
                        { $match: { "events.notificationStatus": { $in: oversightNotificationStatuses } } },
                        { $group: { _id: "$events.notificationStatus", count: { $sum: 1 } } },
                    ],
                } },
            ]),
        ]);
        const counts = Object.fromEntries((summary[0]?.byStatus ?? []).map(({ _id, count }) => [_id, count]));
        const notificationCounts = Object.fromEntries((summary[0]?.notificationEvents ?? []).map(({ _id, count }) => [_id, count]));
        return res.status(200).json({
            interviews: rows.map(publicOversightInterview),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            filters: { ...parsed.dates, ...(filter.status ? { status: filter.status } : {}), ...(filter.company ? { company: String(filter.company) } : {}) },
            summary: {
                totalInterviews: total,
                interviewsByStatus: ["SCHEDULED", "COMPLETED", "CANCELLED"].map((status) => ({ status, count: counts[status] ?? 0 })),
                notificationEventsByStatus: oversightNotificationStatuses
                    .filter((status) => notificationCounts[status] !== undefined)
                    .map((status) => ({ status, count: notificationCounts[status] })),
                notificationEventCount: Object.values(notificationCounts).reduce((sum, count) => sum + count, 0),
            },
        });
    } catch (error) {
        console.error("Interview oversight retrieval failed", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Interview oversight could not be loaded" });
    }
}

export async function createInterview(req, res) {
    const companyId = identity(req, "COMPANY");
    if (!validId(companyId)) return res.status(403).json({ message: "A company account is required" });
    const key = requestKey(req, res);
    if (!key) return;
    const parsed = parseSchedule(req.body);
    if (parsed.error) return res.status(400).json({ message: parsed.error });
    const applicationId = req.body?.applicationId;
    if (!validId(applicationId)) return res.status(400).json({ message: "A valid applicationId is required" });
    try {
        const replay = await replayForCompany(companyId, key);
        if (replay) return res.status(200).json({ interview: publicInterview(replay), replayed: true });
        const application = await Application.findById(applicationId)
            .populate({ path: "drive", select: "title company", populate: { path: "company", select: "name companyName" } })
            .populate({ path: "student", select: "name email department course" })
            .lean();
        if (!application?.drive || !application.student) return res.status(404).json({ message: "Application not found" });
        if (String(application.drive?.company?._id ?? application.drive?.company) !== companyId) return res.status(404).json({ message: "Application not found" });
        if (!schedulableApplicationStatuses.has(application.status)) return res.status(409).json({ message: "This application is no longer eligible for interview scheduling" });
        const event = eventFor({ requestId: key, action: "SCHEDULED", changedBy: companyId, schedule: parsed.value, notificationStatus: "PENDING" });
        const interview = await Interview.create({
            application: application._id,
            student: application.student._id,
            company: companyId,
            drive: application.drive._id,
            ...parsed.value,
            status: "SCHEDULED",
            events: [event],
        });
        const populated = publicInterview({
            ...interview.toObject(),
            student: application.student,
            company: application.drive.company,
            drive: application.drive,
            application: { _id: application._id, status: application.status, appliedAt: application.appliedAt },
        });
        const notification = await sendStudentUpdate(populated, event, "SCHEDULED");
        const message = notification === "FAILED" ? "Interview scheduled, but the student email could not be delivered" : "Interview scheduled";
        return res.status(201).json({ message, notification, interview: populated });
    } catch (error) {
        if (error?.code === 11000) {
            try {
                const replay = await replayForCompany(companyId, key);
                if (replay) return res.status(200).json({ interview: publicInterview(replay), replayed: true });
            } catch { /* report the duplicate safely below */ }
            return res.status(409).json({ message: "An active interview already exists for this application or request" });
        }
        if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: "Invalid interview details" });
        console.error("Interview scheduling failed", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Interview could not be scheduled" });
    }
}

async function updateInterview(req, res, action) {
    const companyId = identity(req, "COMPANY");
    if (!validId(companyId)) return res.status(403).json({ message: "A company account is required" });
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid interview ID" });
    const key = requestKey(req, res);
    if (!key) return;
    const current = await replayForCompany(companyId, key).catch(() => null);
    if (current) return res.status(200).json({ interview: publicInterview(current), replayed: true });
    let interview;
    try {
        interview = await populateInterview(Interview.findOne({ _id: req.params.id, company: companyId }), { includeStudentEmail: true }).lean();
    } catch (error) {
        console.error("Interview lookup failed", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Interview could not be loaded" });
    }
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.status !== "SCHEDULED") return res.status(409).json({ message: "Only scheduled interviews can be changed" });

    let schedule = eventSnapshot(interview);
    let note;
    let nextStatus = interview.status;
    let notificationStatus = "NOT_REQUIRED";
    if (action === "RESCHEDULED") {
        const parsed = parseSchedule(req.body);
        if (parsed.error) return res.status(400).json({ message: parsed.error });
        schedule = parsed.value;
        notificationStatus = "PENDING";
    } else {
        if (req.body?.note !== undefined && (typeof req.body.note !== "string" || req.body.note.length > 2000)) return res.status(400).json({ message: "note must be a string of at most 2000 characters" });
        note = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;
        nextStatus = action;
        if (action === "CANCELLED") notificationStatus = "PENDING";
    }
    const event = eventFor({ requestId: key, action, changedBy: companyId, schedule, notificationStatus, note });
    const update = {
        $push: { events: event },
        ...(action === "RESCHEDULED" ? { $set: schedule } : { $set: { status: nextStatus } }),
    };
    try {
        const updated = await populateInterview(Interview.findOneAndUpdate(
            { _id: interview._id, company: companyId, status: "SCHEDULED", updatedAt: interview.updatedAt, "events.requestId": { $ne: key } },
            update,
            { new: true, runValidators: true },
        ), { includeStudentEmail: true }).lean();
        if (!updated) {
            const replay = await replayForCompany(companyId, key);
            if (replay) return res.status(200).json({ interview: publicInterview(replay), replayed: true });
            return res.status(409).json({ message: "Interview changed before your update; reload and try again" });
        }
        const notification = action === "RESCHEDULED" || action === "CANCELLED" ? await sendStudentUpdate(updated, event, action) : "NOT_REQUIRED";
        const operation = action === "RESCHEDULED" ? "Interview rescheduled" : action === "CANCELLED" ? "Interview cancelled" : "Interview marked completed";
        const message = notification === "FAILED" ? `${operation}, but the student email could not be delivered` : operation;
        return res.status(200).json({ message, notification, interview: publicInterview(updated) });
    } catch (error) {
        if (error?.code === 11000) {
            const replay = await replayForCompany(companyId, key).catch(() => null);
            if (replay) return res.status(200).json({ interview: publicInterview(replay), replayed: true });
            return res.status(409).json({ message: "This interview update was already submitted" });
        }
        if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: "Invalid interview details" });
        console.error("Interview update failed", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Interview could not be updated" });
    }
}

export function rescheduleInterview(req, res) { return updateInterview(req, res, "RESCHEDULED"); }
export function cancelInterview(req, res) { return updateInterview(req, res, "CANCELLED"); }
export function completeInterview(req, res) { return updateInterview(req, res, "COMPLETED"); }
