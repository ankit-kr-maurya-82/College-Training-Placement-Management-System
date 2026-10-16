import mongoose from "mongoose";

const announcementSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true, maxlength: 160 },
    body: { type: String, required: true, trim: true, maxlength: 10000 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    publishedAt: { type: Date, default: null },
}, { timestamps: true });

announcementSchema.index({ publishedAt: -1, createdAt: -1 });

export const Announcement = mongoose.models.Announcement || mongoose.model("Announcement", announcementSchema);
export default Announcement;
