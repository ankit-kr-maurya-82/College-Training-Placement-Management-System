import mongoose from "mongoose";

const modes = ["ONLINE", "OFFLINE", "PHONE"];
const statuses = ["SCHEDULED", "COMPLETED", "CANCELLED"];

const eventSchema = new mongoose.Schema({
    requestId: { type: String, required: true, trim: true },
    action: { type: String, enum: ["SCHEDULED", "RESCHEDULED", "CANCELLED", "COMPLETED"], required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, required: true },
    changedAt: { type: Date, required: true, default: Date.now },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timeZone: { type: String, required: true },
    mode: { type: String, enum: modes, required: true },
    meetingLink: { type: String, trim: true },
    venue: { type: String, trim: true },
    instructions: { type: String, trim: true, maxlength: 4000 },
    note: { type: String, trim: true, maxlength: 2000 },
    notificationStatus: { type: String, enum: ["NOT_REQUIRED", "PENDING", "SENDING", "SENT", "FAILED"], default: "NOT_REQUIRED" },
}, { _id: false });

const interviewSchema = new mongoose.Schema({
    application: { type: mongoose.Schema.Types.ObjectId, ref: "Application", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    drive: { type: mongoose.Schema.Types.ObjectId, ref: "Drive", required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    timeZone: { type: String, required: true },
    mode: { type: String, enum: modes, required: true },
    meetingLink: { type: String, trim: true },
    venue: { type: String, trim: true },
    instructions: { type: String, trim: true, maxlength: 4000 },
    status: { type: String, enum: statuses, default: "SCHEDULED", required: true },
    events: { type: [eventSchema], default: [] },
}, { timestamps: true });

interviewSchema.index({ company: 1, startAt: 1 });
interviewSchema.index({ student: 1, startAt: 1 });
interviewSchema.index({ "events.requestId": 1 }, { unique: true, sparse: true });
interviewSchema.index({ application: 1 }, { unique: true, partialFilterExpression: { status: "SCHEDULED" } });

export const Interview = mongoose.models.Interview || mongoose.model("Interview", interviewSchema);
export default Interview;
