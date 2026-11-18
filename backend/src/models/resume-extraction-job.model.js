import mongoose from "mongoose";

const resumeExtractionJobSchema = new mongoose.Schema(
    {
        resume: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true, index: true },
        student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true, index: true },
        storagePublicId: { type: String, required: true, trim: true },
        mimeType: { type: String, required: true },
        status: { type: String, enum: ["PENDING", "PROCESSING", "DONE", "FAILED"], default: "PENDING", index: true },
        attempts: { type: Number, default: 0, min: 0 },
        maxAttempts: { type: Number, default: 3, min: 1 },
        leaseUntil: { type: Date, default: null },
        errorCode: { type: String, trim: true, maxlength: 80 },
        lastErrorAt: { type: Date },
    },
    { timestamps: true },
);

resumeExtractionJobSchema.index({ status: 1, leaseUntil: 1, createdAt: 1 });

export const ResumeExtractionJob = mongoose.model("ResumeExtractionJob", resumeExtractionJobSchema);
export default ResumeExtractionJob;
