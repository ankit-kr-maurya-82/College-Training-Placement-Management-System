import { Company } from "../models/company.model.js";
import { Drive } from "../models/drive.model.js";
import { DriveNotification } from "../models/drive-notification.model.js";
import { DriveNotificationJob } from "../models/drive-notification-job.model.js";
import { Student } from "../models/student.model.js";
import { getApplyUrl, getEligibilityExclusionReason, isValidEmail, sendVacancyEmail } from "./vacancy-email.service.js";

const BATCH_SIZE = 50;
const LEASE_MS = 10 * 60 * 1000;

function safeDeliveryError(error) {
    if (error?.message === "Email delivery is not configured") return error.message;
    const code = typeof error?.code === "string" ? error.code.replace(/[^A-Z0-9_-]/gi, "").slice(0, 40) : "";
    return code ? `Email delivery failed (${code})` : "Email delivery failed";
}

async function queueEligibleStudents(drive, job) {
    const company = await Company.findById(drive.company).select("name companyName").lean();
    if (!company) throw new Error("Vacancy company no longer exists");
    const seenEmails = new Set();
    const operations = [];
    const exclusions = {
        inactiveStudentCount: await Student.countDocuments({ isActive: false }),
        invalidEmailCount: 0,
        duplicateEmailCount: 0,
        missingEducationDataCount: 0,
        minCGPAExcludedCount: 0,
        allowedBranchesExcludedCount: 0,
        graduationYearExcludedCount: 0,
        maxBacklogsExcludedCount: 0,
    };
    let totalStudentsReturned = 0;
    let eligibleRecipientCount = 0;
    let lastLeaseRefreshAt = 0;
    let newlyQueuedCount = 0;
    let alreadyExistingCount = 0;
    const flushOperations = async () => {
        if (!operations.length) return;
        const batchSize = operations.length;
        const result = await DriveNotification.bulkWrite(operations, { ordered: false });
        newlyQueuedCount += result.upsertedCount ?? 0;
        alreadyExistingCount += batchSize - (result.upsertedCount ?? 0);
        operations.length = 0;
    };
    const cursor = Student.find({ isActive: { $ne: false } })
        .select("email cgpa department course graduationYear activeBacklogs")
        .lean().cursor({ batchSize: 500 });
    for await (const student of cursor) {
        totalStudentsReturned += 1;
        if (totalStudentsReturned - lastLeaseRefreshAt >= 500) {
            job.leaseUntil = new Date(Date.now() + LEASE_MS);
            await job.save();
            lastLeaseRefreshAt = totalStudentsReturned;
        }
        const email = typeof student.email === "string" ? student.email.trim().toLowerCase() : "";
        if (!isValidEmail(email)) { exclusions.invalidEmailCount += 1; continue; }
        if (seenEmails.has(email)) { exclusions.duplicateEmailCount += 1; continue; }
        const reason = getEligibilityExclusionReason(student, drive.eligibility);
        if (reason) {
            const counter = {
                missingEducationData: "missingEducationDataCount",
                minCGPA: "minCGPAExcludedCount",
                allowedBranches: "allowedBranchesExcludedCount",
                graduationYear: "graduationYearExcludedCount",
                maxBacklogs: "maxBacklogsExcludedCount",
            }[reason];
            exclusions[counter] += 1;
            continue;
        }
        seenEmails.add(email);
        eligibleRecipientCount += 1;
        operations.push({ updateOne: { filter: { drive: drive._id, student: student._id }, update: { $setOnInsert: { drive: drive._id, student: student._id, email, status: "PENDING", attemptCount: 0 } }, upsert: true } });
        if (operations.length >= 200) {
            await flushOperations();
            job.leaseUntil = new Date(Date.now() + LEASE_MS); await job.save();
        }
    }
    await flushOperations();
    console.info("Vacancy notification recipients selected:", JSON.stringify({
        jobId: String(job._id),
        driveId: String(drive._id),
        queueState: "RECIPIENTS_QUEUED",
        totalStudentsReturned,
        ...exclusions,
        eligibleRecipientCount,
    }));
    const ineligible = {
        inactive: exclusions.inactiveStudentCount,
        invalidEmail: exclusions.invalidEmailCount,
        duplicateEmail: exclusions.duplicateEmailCount,
        missingEducationData: exclusions.missingEducationDataCount,
        minCGPA: exclusions.minCGPAExcludedCount,
        allowedBranches: exclusions.allowedBranchesExcludedCount,
        graduationYear: exclusions.graduationYearExcludedCount,
        maxBacklogs: exclusions.maxBacklogsExcludedCount,
    };
    return {
        company,
        eligibleRecipientCount,
        newlyQueuedCount,
        alreadyExistingCount,
        ineligible,
        totalStudentsReturned,
        inactiveStudentCount: exclusions.inactiveStudentCount,
    };
}

export { queueEligibleStudents };

async function sendPendingDeliveries(drive, company, job) {
    const applyUrl = getApplyUrl(drive._id);
    while (true) {
        const pending = await DriveNotification.find({ drive: drive._id, status: "PENDING", $or: [{ leaseUntil: null }, { leaseUntil: { $lt: new Date() } }] }).select("_id").limit(BATCH_SIZE).lean();
        if (!pending.length) {
            if (await DriveNotification.countDocuments({ drive: drive._id, status: "PENDING" }) === 0) return;
            job.leaseUntil = new Date(Date.now() + LEASE_MS); await job.save();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
        }
        for (const item of pending) {
            const record = await DriveNotification.findOneAndUpdate(
                { _id: item._id, status: "PENDING", $or: [{ leaseUntil: null }, { leaseUntil: { $lt: new Date() } }] },
                { $set: { leaseUntil: new Date(Date.now() + 2 * 60 * 1000) }, $inc: { attemptCount: 1 } },
                { returnDocument: "after" },
            );
            if (!record) continue;
            try {
                await sendVacancyEmail({ to: record.email, drive, company, applyUrl });
                await DriveNotification.updateOne({ _id: record._id, status: "PENDING" }, { $set: { status: "SENT", sentAt: new Date() }, $unset: { leaseUntil: 1, lastError: 1 } });
                console.info("Vacancy email delivery:", JSON.stringify({
                    jobId: String(job._id),
                    driveId: String(drive._id),
                    deliveryId: String(record._id),
                    queueState: "SENT",
                }));
            } catch (error) {
                const safeError = safeDeliveryError(error);
                await DriveNotification.updateOne({ _id: record._id, status: "PENDING" }, { $set: { status: "FAILED", lastError: safeError }, $unset: { leaseUntil: 1 } });
                console.warn("Vacancy email delivery:", JSON.stringify({
                    jobId: String(job._id),
                    driveId: String(drive._id),
                    deliveryId: String(record._id),
                    queueState: "FAILED",
                    error: safeError,
                }));
            }
        }
        job.leaseUntil = new Date(Date.now() + LEASE_MS); await job.save();
    }
}

export async function processNotificationJob(job) {
    console.info("Vacancy notification job processing:", JSON.stringify({ jobId: String(job._id), queueState: "PROCESSING" }));
    try {
        const drive = await Drive.findOne({ _id: job.drive, status: "Published", applicationDeadline: { $gt: new Date() } });
        if (!drive) {
            job.status = "DONE"; job.lastError = "Vacancy is no longer accepting applications"; job.leaseUntil = undefined; await job.save();
            console.info("Vacancy notification job skipped:", JSON.stringify({ jobId: String(job._id), queueState: "DONE", reason: "drive unavailable or expired" }));
            return;
        }
        const { company } = await queueEligibleStudents(drive, job);
        await sendPendingDeliveries(drive, company, job);
        job.status = "DONE"; job.leaseUntil = undefined; job.lastError = undefined; await job.save();
        console.info("Vacancy notification job completed:", JSON.stringify({ jobId: String(job._id), driveId: String(drive._id), queueState: "DONE" }));
    } catch (error) {
        job.status = "FAILED"; job.leaseUntil = undefined; job.lastError = safeDeliveryError(error); await job.save();
        console.error("Vacancy notification job failed:", JSON.stringify({ jobId: String(job._id), driveId: String(job.drive), queueState: "FAILED", error: safeDeliveryError(error) }));
    }
}

let timer;
let polling = false;
export async function startDriveNotificationWorker() {
    if (timer) return;
    console.info("Starting vacancy notification worker:", JSON.stringify({ processId: process.pid, queueState: "INITIALIZING" }));
    await Promise.all([DriveNotification.init(), DriveNotificationJob.init()]);
    await Promise.all([
        DriveNotification.updateMany({ status: "Sent" }, { $set: { status: "SENT" } }),
        DriveNotification.updateMany({ status: "Failed" }, { $set: { status: "FAILED" } }),
        DriveNotification.updateMany({ status: "Sending" }, { $set: { status: "FAILED", lastError: "Previous notification attempt was interrupted" } }),
    ]);
    const poll = async () => {
        if (polling) return;
        polling = true;
        try {
            while (true) {
                const job = await DriveNotificationJob.findOneAndUpdate(
                    { $or: [{ status: "PENDING" }, { status: "PROCESSING", leaseUntil: { $lt: new Date() } }] },
                    { $set: { status: "PROCESSING", leaseUntil: new Date(Date.now() + LEASE_MS) } },
                    { returnDocument: "after", sort: { createdAt: 1 } },
                );
                if (!job) break;
                await processNotificationJob(job);
            }
        } catch (error) {
            console.error("Vacancy notification worker poll failed:", safeDeliveryError(error));
        } finally { polling = false; }
    };
    timer = setInterval(poll, 5000);
    timer.unref?.();
    console.info("Vacancy notification worker polling:", JSON.stringify({ processId: process.pid, intervalMs: 5000, queueState: "POLLING" }));
    void poll();
}

export const notificationBatchSize = BATCH_SIZE;
