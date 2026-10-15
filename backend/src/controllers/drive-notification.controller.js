import { Company } from "../models/company.model.js";
import { Drive } from "../models/drive.model.js";
import { DriveNotification } from "../models/drive-notification.model.js";
import { Student } from "../models/student.model.js";
import { getApplyUrl, isEligibleStudent, isValidEmail, sendVacancyEmail } from "../services/vacancy-email.service.js";

const validId = (id) => /^[a-f\d]{24}$/i.test(id ?? "");

export async function notifyEligibleStudents(req, res) {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid drive ID" });
    try {
        const drive = await Drive.findOne({ _id: req.params.id, company: req.user.companyId });
        if (!drive) return res.status(404).json({ message: "Drive not found" });
        if (drive.status !== "Published") return res.status(409).json({ message: "Only published drives can be notified" });
        if (!(drive.applicationDeadline > new Date())) return res.status(409).json({ message: "The application deadline has passed" });
        const company = await Company.findById(drive.company).select("name companyName").lean();
        const students = await Student.find({ isActive: { $ne: false } }).select("name email cgpa department course graduationYear activeBacklogs").lean();
        const eligible = students.filter((student) => isEligibleStudent(student, drive.eligibility));
        const unique = new Map();
        let invalidRecipients = 0, duplicateRecipients = 0;
        for (const student of eligible) {
            const email = typeof student.email === "string" ? student.email.trim().toLowerCase() : "";
            if (!isValidEmail(email)) { invalidRecipients++; continue; }
            if (unique.has(email)) { duplicateRecipients++; continue; }
            unique.set(email, student);
        }
        let sent = 0, failed = 0, skipped = 0;
        const applyUrl = getApplyUrl(drive._id);
        for (const [email, student] of unique) {
            let record;
            try {
                record = await DriveNotification.findOneAndUpdate(
                    { drive: drive._id, student: student._id, status: "Failed" },
                    { $set: { email, status: "Sending", lastError: "" }, $inc: { attempts: 1 } },
                    { new: true },
                );
                if (!record) {
                    record = await DriveNotification.create({ drive: drive._id, student: student._id, email, status: "Sending", attempts: 1 });
                }
            } catch (error) {
                if (error?.code === 11000) { skipped++; continue; }
                throw error;
            }
            try {
                await sendVacancyEmail({ to: email, drive, company, applyUrl });
                record.status = "Sent"; record.sentAt = new Date(); record.lastError = ""; await record.save(); sent++;
            } catch (error) {
                record.status = "Failed"; record.lastError = error?.message === "Email delivery is not configured" ? error.message : "Email delivery failed"; await record.save(); failed++;
            }
        }
        return res.status(200).json({ message: "Notification run completed", eligible: eligible.length, sent, failed, skipped, invalidRecipients, duplicateRecipients, applyUrl });
    } catch (error) {
        if (["ValidationError", "CastError"].includes(error?.name)) return res.status(400).json({ message: "Invalid notification request" });
        console.error("Error notifying eligible students:", error?.message || "Notification operation failed");
        return res.status(500).json({ message: "Unable to complete notification run" });
    }
}
