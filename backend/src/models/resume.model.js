import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
            unique: true,
            index: true,
        },
        originalFileName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255,
        },
        storageProvider: {
            type: String,
            required: true,
            enum: ["cloudinary"],
            default: "cloudinary",
        },
        storagePublicId: {
            type: String,
            required: true,
            trim: true,
        },
        mimeType: {
            type: String,
            required: true,
            enum: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        },
        fileSize: {
            type: Number,
            required: true,
            min: 1,
            max: 5 * 1024 * 1024,
        },
        extractionStatus: {
            type: String,
            enum: ["PENDING", "SUCCESS", "FAILED", "EMPTY"],
            default: "PENDING",
        },
        extractedText: {
            type: String,
            select: false,
            maxlength: 100000,
        },
        extractedAt: {
            type: Date,
        },
        extractionErrorCode: {
            type: String,
            trim: true,
            maxlength: 80,
        },
        analysisStatus: {
            type: String,
            enum: ["PENDING", "SUCCESS", "FAILED", "SKIPPED"],
            default: "PENDING",
        },
        analysisVersion: {
            type: Number,
            default: 1,
        },
        analyzedAt: {
            type: Date,
        },
        analysis: {
            type: mongoose.Schema.Types.Mixed,
            select: false,
        },
        analysisErrorCode: {
            type: String,
            trim: true,
            maxlength: 80,
        },
    },
    { timestamps: true },
);

resumeSchema.index({ student: 1 }, { unique: true });

export const Resume = mongoose.model("Resume", resumeSchema);
export default Resume;
