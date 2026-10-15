import { Student } from "../models/student.model.js";

const profileFields = new Set([
    "name", "phone", "department", "course", "graduationYear", "cgpa", "skills", "resumeUrl",
]);
const currentYear = () => new Date().getFullYear();
const phonePattern = /^\+?[0-9][0-9\s().-]{6,22}$/;

function profileFrom(student) {
    return {
        _id: student._id,
        name: student.name,
        email: student.email,
        phone: student.phone ?? "",
        department: student.department ?? "",
        course: student.course ?? "",
        graduationYear: student.graduationYear ?? null,
        cgpa: student.cgpa ?? null,
        skills: student.skills ?? [],
        resumeUrl: student.resumeUrl ?? "",
    };
}

function validateProfile(body) {
    if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { message: "A profile object is required" };
    }
    const unknown = Object.keys(body).find((key) => !profileFields.has(key));
    if (unknown) return { message: `Unsupported profile field: ${unknown}` };
    if (Object.keys(body).length === 0) return { message: "At least one profile field is required" };

    const updates = {};
    for (const [key, value] of Object.entries(body)) {
        if (["name", "department", "course", "phone", "resumeUrl"].includes(key)) {
            if (typeof value !== "string") return { message: `${key} must be text` };
            const normalized = value.trim();
            const maxLength = key === "resumeUrl" ? 2048 : key === "name" ? 120 : 100;
            if (normalized.length > maxLength) return { message: `${key} must be ${maxLength} characters or fewer` };
            if (key === "name" && !normalized) return { message: "Full name is required" };
            if (key === "phone" && normalized && !phonePattern.test(normalized)) {
                return { message: "Enter a valid phone number" };
            }
            if (key === "resumeUrl" && normalized) {
                try {
                    const url = new URL(normalized);
                    if (url.protocol !== "https:" || !url.hostname || url.username || url.password) throw new Error();
                } catch {
                    return { message: "Resume URL must be a valid HTTPS URL" };
                }
            }
            updates[key] = normalized;
            continue;
        }

        if (key === "graduationYear") {
            if (value === null || value === "") {
                updates[key] = null;
            } else if (!Number.isInteger(value) || value < 1900 || value > currentYear() + 10) {
                return { message: `Graduation year must be a whole year between 1900 and ${currentYear() + 10}` };
            } else {
                updates[key] = value;
            }
            continue;
        }

        if (key === "cgpa") {
            if (value === null || value === "") {
                updates[key] = null;
            } else if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 10) {
                return { message: "CGPA must be a number between 0 and 10" };
            } else {
                updates[key] = value;
            }
            continue;
        }

        if (key === "skills") {
            if (!Array.isArray(value) || value.length > 30 || value.some((skill) => typeof skill !== "string" || !skill.trim() || skill.trim().length > 50)) {
                return { message: "Skills must be a list of up to 30 non-empty items, each 50 characters or fewer" };
            }
            const seen = new Set();
            updates[key] = value.map((skill) => skill.trim()).filter((skill) => {
                const normalized = skill.toLowerCase();
                if (seen.has(normalized)) return false;
                seen.add(normalized);
                return true;
            });
        }
    }
    return { updates };
}

export async function getMyStudentProfile(req, res) {
    if (!req.studentAccount) return res.status(404).json({ message: "Student profile not found" });
    return res.status(200).json({ student: profileFrom(req.studentAccount) });
}

export async function updateMyStudentProfile(req, res) {
    const { updates, message } = validateProfile(req.body);
    if (message) return res.status(400).json({ message });

    try {
        const student = await Student.findByIdAndUpdate(
            req.user.studentId,
            { $set: updates },
            { returnDocument: "after", runValidators: true },
        ).select("name email phone department course graduationYear cgpa skills resumeUrl").lean();
        if (!student) return res.status(404).json({ message: "Student profile not found" });
        return res.status(200).json({ message: "Student profile updated successfully", student: profileFrom(student) });
    } catch (error) {
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ message: "Invalid student profile data" });
        }
        console.error("Error updating student profile:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
