import { OAuth2Client } from "google-auth-library";
import { Student } from "../models/student.model.js";
import { createStudentToken, publicStudent } from "./student.controller.js";

const googleClient = new OAuth2Client();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidGooglePayload(payload, clientId) {
    return payload
        && typeof payload.sub === "string"
        && payload.sub.trim()
        && typeof payload.email === "string"
        && emailPattern.test(payload.email.trim())
        && payload.email_verified === true
        && typeof payload.name === "string"
        && payload.name.trim()
        && ["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)
        && payload.aud === clientId
        && Number.isFinite(payload.exp)
        && payload.exp * 1000 > Date.now();
}

function signedInStudent(res, student, statusCode, message) {
    if (student.isActive === false) {
        return res.status(403).json({ message: "Student account is disabled" });
    }
    return res.status(statusCode).json({
        message,
        student: publicStudent(student),
        token: createStudentToken(student),
    });
}

export async function loginWithGoogle(req, res) {
    const body = req.body;
    if (!body || typeof body !== "object" || Array.isArray(body)
        || Object.keys(body).some((key) => key !== "credential")
        || typeof body.credential !== "string"
        || !body.credential.trim()
        || body.credential !== body.credential.trim()
        || body.credential.length > 8192) {
        return res.status(400).json({ message: "A valid Google credential is required" });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
        return res.status(503).json({ message: "Google sign-in is not configured" });
    }
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({ message: "Authentication is not configured" });
    }

    let payload;
    try {
        const ticket = await googleClient.verifyIdToken({
            idToken: body.credential.trim(),
            audience: clientId,
        });
        payload = ticket.getPayload();
    } catch {
        return res.status(401).json({ message: "Google credential could not be verified" });
    }

    if (!isValidGooglePayload(payload, clientId)) {
        return res.status(401).json({ message: "Google credential could not be verified" });
    }

    const googleId = payload.sub.trim();
    const email = payload.email.trim().toLowerCase();
    try {
        const linkedStudent = await Student.findOne({ googleId });
        if (linkedStudent) {
            return signedInStudent(res, linkedStudent, 200, "Student logged in successfully");
        }

        const emailStudent = await Student.findOne({ email });
        if (emailStudent) {
            return res.status(409).json({
                message: "An account with this email already exists. Sign in with your existing account.",
            });
        }

        const student = await Student.create({
            googleId,
            name: payload.name.trim(),
            email,
            isEmailVerified: true,
        });
        return signedInStudent(res, student, 201, "Student registered successfully");
    } catch (error) {
        if (error.code === 11000) {
            try {
                const concurrentlyCreated = await Student.findOne({ googleId });
                if (concurrentlyCreated) {
                    return signedInStudent(res, concurrentlyCreated, 200, "Student logged in successfully");
                }
                const emailConflict = await Student.findOne({ email });
                if (emailConflict) {
                    return res.status(409).json({
                        message: "An account with this email already exists. Sign in with your existing account.",
                    });
                }
            } catch (lookupError) {
                console.error("Error resolving concurrent Google sign-in:", lookupError);
                return res.status(500).json({ message: "Internal server error" });
            }
            return res.status(409).json({
                message: "Unable to complete Google sign-in. Please try again.",
            });
        }
        if (error.name === "ValidationError" || error.name === "CastError") {
            return res.status(400).json({ message: "Invalid Google account data" });
        }
        console.error("Error signing in with Google:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}
