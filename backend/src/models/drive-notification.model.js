import mongoose from "mongoose";

const driveNotificationSchema = new mongoose.Schema({
    drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    status: { type: String, enum: ["Sending", "Sent", "Failed"], default: "Sending", index: true },
    attempts: { type: Number, default: 1 },
    lastError: { type: String, maxlength: 500 },
    sentAt: Date,
}, { timestamps: true });

driveNotificationSchema.index({ drive: 1, student: 1 }, { unique: true });
export const DriveNotification = mongoose.models.DriveNotification || mongoose.model("DriveNotification", driveNotificationSchema);
export default DriveNotification;
