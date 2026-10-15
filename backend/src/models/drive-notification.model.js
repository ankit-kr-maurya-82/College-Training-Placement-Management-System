import mongoose from "mongoose";

const driveNotificationSchema = new mongoose.Schema({
    drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["PENDING", "SENT", "FAILED"], default: "PENDING", index: true },
    attemptCount: { type: Number, default: 0 },
    lastError: { type: String, maxlength: 500 },
    sentAt: Date,
    leaseUntil: Date,
}, { timestamps: true });

driveNotificationSchema.index({ drive: 1, student: 1 }, { unique: true });
driveNotificationSchema.index({ status: 1, leaseUntil: 1, createdAt: 1 });
export const DriveNotification = mongoose.models.DriveNotification || mongoose.model("DriveNotification", driveNotificationSchema);
export default DriveNotification;
