import jwt from "jsonwebtoken";
import { Student } from "../models/student.model.js";

export function authenticateToken(req, res, next) {
    const authorization = req.get("authorization") ?? "";
    const [scheme, token] = authorization.split(" ");
    if (scheme !== "Bearer" || !token) {
        return res.status(401).json({ message: "Authentication required" });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: "Authentication is not configured" });
    }
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ message: "Invalid or expired token" });
    }
}

export default authenticateToken;

export async function requireActiveStudent(req, res, next) {
    const studentId = req.user?.studentId;
    if (typeof studentId !== "string" || !/^[a-f\d]{24}$/i.test(studentId)) {
        return res.status(403).json({ message: "A student account is required" });
    }
    try {
        const student = await Student.findById(studentId)
            .select("isActive cgpa department course graduationYear activeBacklogs resumeUrl")
            .lean();
        if (!student) return res.status(401).json({ message: "Student account not found" });
        if (student.isActive === false) return res.status(403).json({ message: "Student account is disabled" });
        req.studentAccount = student;
        return next();
    } catch (error) {
        console.error("Error verifying student account:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export function requireActiveStudentOrManager(req, res, next) {
    if (["ADMIN", "TPO"].includes(String(req.user?.role ?? "").toUpperCase())) return next();
    return requireActiveStudent(req, res, next);
}
