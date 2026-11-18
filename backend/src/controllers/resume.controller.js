import { ResumeExtractionJob } from "../models/resume-extraction-job.model.js";
import { analyzeResumeText } from "../services/resume-analysis.service.js";

export async function uploadStudentResume(req, res) {
    if (!req.user?.studentId) return res.status(403).json({ message: "Student access is required" });
    if (!req.file) return res.status(400).json({ message: "A resume file is required" });

    const studentId = req.user.studentId;
    const existing = await Resume.findOne({ student: studentId }).lean();
    let uploaded;
    try {
        uploaded = await uploadResume(req.file.buffer);
    } catch (error) {
        console.error("Resume upload failed:", error);
        return res.status(502).json({ message: "Resume upload failed. Please try again." });
    }

    try {
        const resume = await Resume.findOneAndUpdate(
            { student: studentId },
            {
                $set: {
                    originalFileName: req.file.originalname || "resume",
                    storageProvider: "cloudinary",
                    storagePublicId: uploaded.publicId,
                    mimeType: req.file.mimetype,
                    fileSize: req.file.buffer.length,
                    extractionStatus: "PENDING",
                    extractedText: null,
                    extractedAt: null,
                    extractionErrorCode: null,
                },
            },
            { upsert: true, new: true, runValidators: true },
        );
        if (existing?.storagePublicId && existing.storagePublicId !== uploaded.publicId) {
            deleteResume(existing.storagePublicId).catch((error) => console.warn("Resume cleanup failed:", error));
        }

        await ResumeExtractionJob.create({
            resume: resume._id,
            student: studentId,
            storagePublicId: uploaded.publicId,
            mimeType: req.file.mimetype,
        });

        return res.status(200).json({
            message: "Resume uploaded successfully",
            resume: toMetadata(resume),
        });
    } catch (error) {
        await deleteResume(uploaded.publicId).catch(() => {});
        if (error?.code === 11000) return res.status(409).json({ message: "Resume already exists" });
        console.error("Error saving resume:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function getStudentResume(req, res) {
    if (!req.user?.studentId) return res.status(403).json({ message: "Student access is required" });
    const resume = await Resume.findOne({ student: req.user.studentId }).lean();
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    const downloadUrl = await getSignedResumeUrl(resume.storagePublicId);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    return res.status(200).json({ resume: { ...toMetadata(resume), downloadUrl, downloadExpiresAt: expiresAt } });
}

export async function deleteStudentResume(req, res) {
    if (!req.user?.studentId) return res.status(403).json({ message: "Student access is required" });
    const resume = await Resume.findOne({ student: req.user.studentId });
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    try {
        await deleteResume(resume.storagePublicId);
    } catch (error) {
        console.warn("Resume storage deletion failed:", error);
    }
    await resume.deleteOne();
    return res.status(200).json({ message: "Resume deleted successfully" });
}

export async function getResumeAnalysisStatus(req, res) {
    if (!req.user?.studentId) return res.status(403).json({ message: "Student access is required" });
    const resume = await Resume.findOne({ student: req.user.studentId }).lean();
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    const job = await ResumeExtractionJob.findOne({ resume: resume._id }).sort({ createdAt: -1 }).lean();
    return res.status(200).json({
        extractionStatus: resume.extractionStatus,
        extractionErrorCode: resume.extractionErrorCode || null,
        extractedAt: resume.extractedAt || null,
        job: job ? { status: job.status, attempts: job.attempts, maxAttempts: job.maxAttempts, errorCode: job.errorCode || null } : null,
    });
}

export async function retryResumeExtraction(req, res) {
    if (!req.user?.studentId) return res.status(403).json({ message: "Student access is required" });
    const resume = await Resume.findOne({ student: req.user.studentId });
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    const job = await ResumeExtractionJob.findOne({ resume: resume._id }).sort({ createdAt: -1 });
    if (!job) return res.status(404).json({ message: "Extraction job not found" });
    if (job.attempts >= job.maxAttempts && job.status === "FAILED") {
        return res.status(429).json({ message: "Retry limit reached" });
    }
    job.status = "PENDING";
    job.leaseUntil = null;
    job.errorCode = null;
    await job.save();
    await Resume.findByIdAndUpdate(resume._id, { $set: { extractionStatus: "PENDING", extractionErrorCode: null } });
    return res.status(200).json({ message: "Extraction retry scheduled", extractionStatus: "PENDING" });
}
export async function analyzeStudentResume(req, res) {
    if (!req.user?.studentId) return res.status(403).json({ message: "Student access is required" });
    const resume = await Resume.findOne({ student: req.user.studentId }).select("+extractedText");
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    if (resume.extractionStatus !== "SUCCESS") {
        return res.status(409).json({ message: "Resume extraction is not complete" });
    }
    const analysis = analyzeResumeText(resume.extractedText || "");
    const updated = await Resume.findOneAndUpdate(
        { _id: resume._id, updatedAt: resume.updatedAt },
        { $set: { analysisStatus: "SUCCESS", analysisVersion: (resume.analysisVersion || 0) + 1, analysis, analyzedAt: new Date(), analysisErrorCode: null } },
        { new: true },
    );
    if (!updated) return res.status(409).json({ message: "Resume changed during analysis" });
    return res.status(200).json({ message: "Resume analyzed successfully", analysisStatus: "SUCCESS" });
}

export async function getStudentResumeAnalysis(req, res) {
    if (!req.user?.studentId) return res.status(403).json({ message: "Student access is required" });
    const resume = await Resume.findOne({ student: req.user.studentId }).select("+analysis analysisStatus analyzedAt analysisErrorCode analysisVersion").lean();
    if (!resume) return res.status(404).json({ message: "Resume not found" });
    const response = { analysisStatus: resume.analysisStatus, analyzedAt: resume.analyzedAt, analysisErrorCode: resume.analysisErrorCode || null, analysisVersion: resume.analysisVersion };
    if (resume.analysisStatus === "SUCCESS" && resume.analysis) response.analysis = resume.analysis;
    return res.status(200).json(response);
}
function toMetadata(resume) {
    return {
        id: resume._id,
        originalFileName: resume.originalFileName,
        mimeType: resume.mimeType,
        fileSize: resume.fileSize,
        extractionStatus: resume.extractionStatus,
        extractedAt: resume.extractedAt,
        uploadedAt: resume.createdAt,
        updatedAt: resume.updatedAt,
    };
}
