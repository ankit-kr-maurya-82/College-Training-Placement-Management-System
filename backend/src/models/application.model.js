import mongoose from "mongoose";

const statusValues = ["Applied", "Under Review", "Shortlisted", "Interview Scheduled", "Selected", "Rejected", "Withdrawn"];
const urlPattern = /^https?:\/\/.+/i;

const applicationSchema = new mongoose.Schema({
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true },
    resumeUrl: { type: String, required: true, trim: true, validate: { validator: (value) => urlPattern.test(value), message: "Resume must be a valid HTTP(S) URL" } },
    coverLetter: { type: String, trim: true, maxlength: 10000 },
    status: { type: String, enum: statusValues, default: "Applied", required: true },
    appliedAt: { type: Date, default: Date.now, required: true },
    statusHistory: [{
        status: { type: String, enum: statusValues, required: true },
        changedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
        changedAt: { type: Date, default: Date.now, required: true },
        note: { type: String, trim: true, maxlength: 2000 },
    }],
}, { timestamps: true });

applicationSchema.index({ student: 1, drive: 1 }, { unique: true });
applicationSchema.index({ student: 1, appliedAt: -1 });
applicationSchema.index({ drive: 1, status: 1 });

export const Application = mongoose.models.Application || mongoose.model("Application", applicationSchema);
export default Application;
