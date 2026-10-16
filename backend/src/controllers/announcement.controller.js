import { Announcement } from "../models/announcement.model.js";

const validId = (value) => /^[a-f\d]{24}$/i.test(value ?? "");

function handleError(res, error, operation) {
    if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: "Invalid announcement data" });
    console.error(`Error ${operation}:`, error);
    return res.status(500).json({ message: "Internal server error" });
}

export async function listStudentAnnouncements(_req, res) {
    try {
        const announcements = await Announcement.find({ publishedAt: { $ne: null, $lte: new Date() } })
            .select("title body publishedAt createdAt")
            .sort({ publishedAt: -1, createdAt: -1 })
            .limit(100)
            .lean();
        return res.status(200).json({ announcements });
    } catch (error) { return handleError(res, error, "listing student announcements"); }
}

export async function listManagedAnnouncements(_req, res) {
    try {
        const announcements = await Announcement.find({})
            .select("title body publishedAt createdBy createdAt updatedAt")
            .sort({ createdAt: -1 })
            .limit(100)
            .lean();
        return res.status(200).json({ announcements });
    } catch (error) { return handleError(res, error, "listing announcements"); }
}

export async function createAnnouncement(req, res) {
    const { title, body } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || title.trim().length > 160
        || typeof body !== "string" || !body.trim() || body.trim().length > 10000
        || Object.keys(req.body ?? {}).some((key) => !["title", "body"].includes(key))) {
        return res.status(400).json({ message: "A title (1–160 characters) and message (1–10000 characters) are required" });
    }
    if (!validId(req.user?.userId)) return res.status(401).json({ message: "Authenticated manager account required" });
    try {
        const announcement = await Announcement.create({ title: title.trim(), body: body.trim(), createdBy: req.user.userId });
        return res.status(201).json({ announcement });
    } catch (error) { return handleError(res, error, "creating announcement"); }
}

export async function publishAnnouncement(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid announcement ID" });
    try {
        const announcement = await Announcement.findById(req.params.id);
        if (!announcement) return res.status(404).json({ message: "Announcement not found" });
        if (!announcement.publishedAt) {
            announcement.publishedAt = new Date();
            await announcement.save();
        }
        return res.status(200).json({ announcement });
    } catch (error) { return handleError(res, error, "publishing announcement"); }
}

export async function deleteAnnouncement(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid announcement ID" });
    try {
        const announcement = await Announcement.findByIdAndDelete(req.params.id);
        if (!announcement) return res.status(404).json({ message: "Announcement not found" });
        return res.status(200).json({ message: "Announcement deleted" });
    } catch (error) { return handleError(res, error, "deleting announcement"); }
}
