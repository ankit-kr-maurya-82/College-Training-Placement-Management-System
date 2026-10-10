import mongoose from "mongoose";

const driveSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    description: { type: String, required: true, trim: true },
    jobType: { type: String, enum: ["Full-time", "Internship", "Part-time"], required: true },
    location: { type: String, required: true, trim: true },
    workMode: { type: String, enum: ["On-site", "Hybrid", "Remote"], required: true },
    ctc: { type: String, trim: true },
    eligibility: {
        minCGPA: { type: Number, min: 0, max: 10 },
        allowedBranches: [{ type: String, trim: true }],
        graduationYear: { type: Number, min: 1900, validate: { validator: Number.isInteger, message: "Graduation year must be a whole number" } },
        maxBacklogs: { type: Number, min: 0, validate: { validator: Number.isInteger, message: "Maximum backlogs must be a whole number" } },
    },
    requiredSkills: [{ type: String, trim: true }],
    applicationDeadline: { type: Date, required: true, index: true },
    driveDate: { type: Date },
    openings: { type: Number, min: 1, validate: { validator: Number.isInteger, message: "Openings must be a positive whole number" }, default: 1 },
    status: { type: String, enum: ["Draft", "Published", "Closed", "Cancelled"], default: "Draft", index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

driveSchema.index({ status: 1, applicationDeadline: 1, createdAt: -1 });
driveSchema.index({ title: "text", description: "text", location: "text", requiredSkills: "text" });

export const Drive = mongoose.models.Drive || mongoose.model("Drive", driveSchema);
export default Drive;
