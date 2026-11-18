import { Resume } from "../models/resume.model.js";
import { ResumeExtractionJob } from "../models/resume-extraction-job.model.js";
import { downloadResumeBuffer } from "./resume-storage.service.js";
import { extractResumeText } from "./resume-extraction.service.js";

const POLL_MS = 5000;
const LEASE_MS = 2 * 60 * 1000;
let timer = null;
let running = false;

async function claimJob() {
    const now = new Date();
    return ResumeExtractionJob.findOneAndUpdate(
        { status: "PENDING", $or: [{ leaseUntil: null }, { leaseUntil: { $lt: now } }] },
        { $set: { status: "PROCESSING", leaseUntil: new Date(Date.now() + LEASE_MS) }, $inc: { attempts: 1 } },
        { new: true, sort: { createdAt: 1 } },
    );
}

async function processJob(job) {
    const resume = await Resume.findById(job.resume).lean();
    if (!resume || resume.storagePublicId !== job.storagePublicId) {
        await ResumeExtractionJob.findByIdAndUpdate(job._id, { $set: { status: "DONE", errorCode: "STALE_JOB" } });
        return;
    }
    try {
        const buffer = await downloadResumeBuffer(job.storagePublicId);
        const result = await extractResumeText(buffer, job.mimeType);
        const stillCurrent = await Resume.findOne({ _id: job.resume, storagePublicId: job.storagePublicId }).lean();
        if (!stillCurrent) {
            await ResumeExtractionJob.findByIdAndUpdate(job._id, { $set: { status: "DONE", errorCode: "STALE_JOB" } });
            return;
        }
        await Resume.findByIdAndUpdate(job.resume, {
            $set: {
                extractionStatus: result.status,
                extractedText: result.text || null,
                extractedAt: new Date(),
                extractionErrorCode: result.errorCode || null,
            },
        });
        await ResumeExtractionJob.findByIdAndUpdate(job._id, { $set: { status: "DONE", leaseUntil: null, errorCode: result.errorCode || null } });
    } catch (error) {
        const attempts = job.attempts;
        const maxAttempts = job.maxAttempts;
        const failedPermanently = attempts >= maxAttempts;
        await ResumeExtractionJob.findByIdAndUpdate(job._id, {
            $set: {
                status: failedPermanently ? "FAILED" : "PENDING",
                leaseUntil: failedPermanently ? null : new Date(Date.now() + Math.min(60000 * attempts, 300000)),
                errorCode: error?.code || "EXTRACTION_FAILED",
                lastErrorAt: new Date(),
            },
        });
        if (failedPermanently) {
            await Resume.findByIdAndUpdate(job.resume, { $set: { extractionStatus: "FAILED", extractionErrorCode: error?.code || "EXTRACTION_FAILED", extractedAt: new Date() } });
        }
    }
}

async function tick() {
    if (running) return;
    running = true;
    try {
        const job = await claimJob();
        if (job) await processJob(job);
    } finally {
        running = false;
    }
}

export function startResumeExtractionWorker() {
    if (timer) return;
    timer = setInterval(() => { tick().catch(() => {}); }, POLL_MS);
    tick().catch(() => {});
}

export function stopResumeExtractionWorker() {
    if (timer) { clearInterval(timer); timer = null; }
}
