import { Student } from "../models/student.model.js";
import { Company } from "../models/company.model.js";
import { deleteProfilePicture, uploadProfilePicture } from "../services/cloudinary.service.js";

const validId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);

async function cleanupUploaded(publicId) {
    try { await deleteProfilePicture(publicId); }
    catch (error) { console.warn("Profile image cleanup failed", { errorName: error?.name || "Error" }); }
}

async function replacePicture({ req, res, Model, id, account, responseKey }) {
    if (!validId(id)) return res.status(403).json({ message: "An authenticated account is required" });
    if (!req.file) return res.status(400).json({ message: "A profilePicture image file is required" });

    let uploaded;
    try {
        uploaded = await uploadProfilePicture(req.file.buffer);
    } catch (error) {
        const providerCode = typeof error?.code === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(error.code)
            ? error.code
            : undefined;
        const providerStatus = Number.isInteger(error?.http_code) ? error.http_code : undefined;
        console.error("Profile picture provider upload failed", {
            errorName: error?.name || "Error",
            ...(providerCode ? { providerCode } : {}),
            ...(providerStatus ? { providerStatus } : {}),
        });
        const status = error?.code === "CLOUDINARY_NOT_CONFIGURED" ? 503 : 502;
        return res.status(status).json({ message: status === 503 ? "Profile picture uploads are not configured" : "Profile picture upload failed. Please try again." });
    }

    let updated;
    try {
        updated = await Model.findByIdAndUpdate(
            id,
            { $set: { profilePictureUrl: uploaded.url, profilePicturePublicId: uploaded.publicId } },
            { returnDocument: "after", runValidators: true },
        ).select("profilePictureUrl +profilePicturePublicId").lean();
        if (!updated) {
            await cleanupUploaded(uploaded.publicId);
            return res.status(404).json({ message: "Profile not found" });
        }
    } catch (error) {
        await cleanupUploaded(uploaded.publicId);
        console.error("Profile picture database update failed", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Profile picture could not be saved. Please try again." });
    }

    const oldPublicId = account?.profilePicturePublicId;
    if (oldPublicId && oldPublicId !== uploaded.publicId) {
        try { await deleteProfilePicture(oldPublicId); }
        catch (error) { console.warn("Previous profile image cleanup failed", { errorName: error?.name || "Error" }); }
    }

    return res.status(200).json({
        message: "Profile picture updated successfully",
        [responseKey]: { profilePictureUrl: updated.profilePictureUrl },
    });
}

export async function uploadStudentProfilePicture(req, res) {
    if (!validId(req.user?.studentId)) return res.status(403).json({ message: "A student account is required" });
    return replacePicture({ req, res, Model: Student, id: req.user.studentId, account: req.studentAccount, responseKey: "student" });
}

export async function uploadCompanyProfilePicture(req, res) {
    if (String(req.user?.role || "").toUpperCase() !== "COMPANY") return res.status(403).json({ message: "A company account is required" });
    return replacePicture({ req, res, Model: Company, id: req.user.companyId, account: req.company, responseKey: "company" });
}
