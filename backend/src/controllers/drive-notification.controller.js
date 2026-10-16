import { Drive } from "../models/drive.model.js";
import { DriveNotification } from "../models/drive-notification.model.js";
import { DriveNotificationJob } from "../models/drive-notification-job.model.js";
import { queueEligibleStudents } from "../services/drive-notification-worker.js";

const validId = (id) => /^[a-f\d]{24}$/i.test(id ?? "");
const JOB_LEASE_MS = 10 * 60 * 1000;

async function claimJobForReprocessing(driveId) {
    const now = new Date();
    const leaseUntil = new Date(Date.now() + JOB_LEASE_MS);
    const job = await DriveNotificationJob.findOneAndUpdate(
        {
            drive: driveId,
            $or: [
                { status: { $in: ["DONE", "FAILED"] } },
                { status: "PROCESSING", $or: [{ leaseUntil: null }, { leaseUntil: { $lte: now } }] },
            ],
        },
        { $set: { status: "PROCESSING", leaseUntil, lastError: "" } },
        { returnDocument: "after" },
    );
    if (job) return { job, claimed: true };

    const existing = await DriveNotificationJob.findOne({ drive: driveId }).select("status leaseUntil selectionSummary").lean();
    if (existing) return { job: existing, claimed: false };
    try {
        const created = await DriveNotificationJob.create({ drive: driveId, status: "PROCESSING", leaseUntil });
        return { job: created, claimed: true };
    } catch (error) {
        if (error?.code !== 11000) throw error;
        const raced = await DriveNotificationJob.findOne({ drive: driveId }).select("status leaseUntil selectionSummary").lean();
        if (raced) return { job: raced, claimed: false };
        throw error;
    }
}

function summaryForResponse(summary) {
    return summary ?? null;
}

function publicJobState(job) {
    if (job?.status === "PENDING") return "PENDING";
    if (job?.status === "PROCESSING") return "PROCESSING";
    return job?.status ?? "UNKNOWN";
}

export async function retryFailedNotifications(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    let claimedJob;
    try {
        const drive = await Drive.findOne({ _id: req.params.id, company: req.user.companyId }).select("_id status applicationDeadline").lean();
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        if (drive.status !== "Published" || drive.applicationDeadline <= new Date()) return res.status(409).json({ message: "This vacancy is not accepting applications" });
        const claim = await claimJobForReprocessing(drive._id);
        if (!claim.claimed) {
            if (claim.job.status === "PROCESSING") return res.status(409).json({ message: "Vacancy notifications are already processing" });
            return res.status(202).json({ message: "Vacancy notifications are already queued", retryQueued: false, retryCount: 0 });
        }
        claimedJob = claim.job;
        const result = await DriveNotification.updateMany(
            { drive: drive._id, status: "FAILED" },
            { $set: { status: "PENDING" }, $unset: { leaseUntil: 1 } },
        );
        claim.job.status = "PENDING";
        claim.job.leaseUntil = undefined;
        claim.job.lastError = undefined;
        await claim.job.save();
        return res.status(202).json({
            message: result.modifiedCount ? "Failed deliveries queued for retry" : "Vacancy notification job queued",
            retryQueued: true,
            retryCount: result.modifiedCount,
        });
    } catch (error) {
        if (claimedJob) {
            claimedJob.status = "FAILED";
            claimedJob.leaseUntil = undefined;
            claimedJob.lastError = "Delivery retry could not be queued";
            await claimedJob.save().catch(() => {});
        }
        console.error("Could not queue failed vacancy notifications:", error?.code === 11000 ? "Duplicate retry request" : "Notification queue unavailable");
        return res.status(500).json({ message: "Unable to queue notification retries" });
    }
}

export async function reprocessCompanyNotifications(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    let claimedJob;
    try {
        const drive = await Drive.findOne({ _id: req.params.id, company: req.user.companyId })
            .select("_id company status applicationDeadline eligibility")
            .lean();
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        if (drive.status !== "Published" || drive.applicationDeadline <= new Date()) {
            return res.status(409).json({ message: "This vacancy is not accepting applications" });
        }

        const claim = await claimJobForReprocessing(drive._id);
        if (!claim.claimed) {
            if (claim.job.status === "PROCESSING") {
                return res.status(409).json({ message: "Vacancy notifications are already processing", jobStatus: "PROCESSING" });
            }
            return res.status(202).json({
                message: "Vacancy notifications are already queued",
                jobStatus: publicJobState(claim.job),
                reprocessQueued: false,
                summary: summaryForResponse(claim.job.selectionSummary),
            });
        }
        claimedJob = claim.job;

        const selection = await queueEligibleStudents(drive, claim.job);
        const failedRecords = await DriveNotification.countDocuments({ drive: drive._id, status: "FAILED" });
        const summary = {
            newlyQueued: selection.newlyQueuedCount,
            alreadyExisting: selection.alreadyExistingCount,
            failedRecords,
            ineligible: selection.ineligible,
        };
        claim.job.selectionSummary = summary;
        claim.job.status = "PENDING";
        claim.job.leaseUntil = undefined;
        claim.job.lastError = undefined;
        await claim.job.save();

        return res.status(202).json({
            message: "Current eligible recipients queued; delivery is pending",
            jobStatus: "PENDING",
            reprocessQueued: true,
            summary,
        });
    } catch (error) {
        if (claimedJob) {
            claimedJob.status = "FAILED";
            claimedJob.leaseUntil = undefined;
            claimedJob.lastError = "Recipient reprocessing failed";
            await claimedJob.save().catch(() => {});
        }
        console.error("Could not reprocess vacancy recipients:", JSON.stringify({
            driveId: req.params.id,
            errorName: error?.name || "Error",
        }));
        return res.status(500).json({ message: "Unable to reprocess vacancy recipients" });
    }
}

export async function getCompanyNotificationSummary(req, res) {
    try {
        const drives = await Drive.find({ company: req.user.companyId }).select("_id").lean();
        const ids = drives.map((drive) => drive._id);
        const [deliveryCounts, jobs] = await Promise.all([
            DriveNotification.aggregate([{ $match: { drive: { $in: ids } } }, { $group: { _id: { drive: "$drive", status: "$status" }, count: { $sum: 1 } } }]),
            DriveNotificationJob.find({ drive: { $in: ids } }).select("drive status").lean(),
        ]);
        const summaries = {};
        for (const id of ids) summaries[String(id)] = { pending: 0, sent: 0, failed: 0, jobStatus: "" };
        for (const row of deliveryCounts) {
            const entry = summaries[String(row._id.drive)];
            if (entry) entry[row._id.status.toLowerCase()] = row.count;
        }
        for (const job of jobs) if (summaries[String(job.drive)]) summaries[String(job.drive)].jobStatus = job.status;
        return res.status(200).json({ notifications: summaries });
    } catch (error) {
        console.error("Could not read vacancy notification summary:", error?.name || "database error");
        return res.status(500).json({ message: "Unable to load notification progress" });
    }
}
