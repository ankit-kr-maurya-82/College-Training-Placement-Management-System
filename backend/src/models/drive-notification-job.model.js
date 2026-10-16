import mongoose from "mongoose";

const schema = new mongoose.Schema({
    drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true, unique: true },
    status: { type: String, enum: ["PENDING", "PROCESSING", "DONE", "FAILED"], default: "PENDING", index: true },
    leaseUntil: Date,
    lastError: { type: String, maxlength: 500 },
}, { timestamps: true });

schema.index({ status: 1, leaseUntil: 1, createdAt: 1 });
export const DriveNotificationJob = mongoose.models.DriveNotificationJob || mongoose.model("DriveNotificationJob", schema);
export default DriveNotificationJob;
