import { Drive } from "../models/drive.model.js";
import { DriveNotification } from "../models/drive-notification.model.js";
import { DriveNotificationJob } from "../models/drive-notification-job.model.js";

const validId = (id) => /^[a-f\d]{24}$/i.test(id ?? "");

export async function retryFailedNotifications(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    try {
        const drive = await Drive.findOne({ _id: req.params.id, company: req.user.companyId }).select("_id status applicationDeadline").lean();
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        if (drive.status !== "Published" || drive.applicationDeadline <= new Date()) return res.status(409).json({ message: "This vacancy is not accepting applications" });
        const [result, job] = await Promise.all([
            DriveNotification.updateMany({ drive: drive._id, status: "FAILED" }, { $set: { status: "PENDING" }, $unset: { leaseUntil: 1 } }),
            DriveNotificationJob.findOne({ drive: drive._id }).select("status").lean(),
        ]);
        const retryQueued = result.modifiedCount > 0 || job?.status === "FAILED" || !job;
        if (retryQueued) {
            await DriveNotificationJob.updateOne({ drive: drive._id }, { $set: { status: "PENDING", lastError: "" }, $unset: { leaseUntil: 1 }, $setOnInsert: { drive: drive._id } }, { upsert: true });
        }
        const message = result.modifiedCount ? "Failed deliveries queued for retry" : retryQueued ? "Vacancy notifications queued" : "No failed notifications need retrying";
        return res.status(202).json({ message, retryQueued, retryCount: result.modifiedCount });
    } catch (error) {
        console.error("Could not queue failed vacancy notifications:", error?.code === 11000 ? "Duplicate retry request" : "Notification queue unavailable");
        return res.status(500).json({ message: "Unable to queue notification retries" });
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
