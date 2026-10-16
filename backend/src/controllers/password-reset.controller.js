import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { Student } from "../models/student.model.js";
import { Company } from "../models/company.model.js";
import { emailPattern, getResetBaseUrl, hashResetToken, sendPasswordResetEmail } from "../services/password-reset.service.js";

const genericMessage = "If an account matches that email, password reset instructions will be sent.";
const models = { STUDENT: { Model: Student, emailField: "email", passwordField: "password", role: "student" }, COMPANY: { Model: Company, emailField: "hrEmail", passwordField: "hrPassword", role: "company" } };
const passRules = (value) => typeof value === "string" && value.length >= 8 && /[A-Z]/.test(value) && /[0-9]/.test(value);

export async function requestPasswordReset(req, res) {
    const type = String(req.params.accountType || "").toUpperCase();
    const spec = models[type];
    const email = req.body?.email;
    if (!spec) return res.status(404).json({ message: "Not found" });
    if (typeof email !== "string" || !emailPattern.test(email.trim())) return res.status(400).json({ message: "A valid email is required" });
    try {
        const account = await spec.Model.findOne({ [spec.emailField]: email.trim().toLowerCase() });
        if (account) {
            const token = randomBytes(32).toString("hex");
            const expires = new Date(Date.now() + 15 * 60 * 1000);
            account.resetPasswordToken = hashResetToken(token);
            account.resetPasswordExpires = expires;
            await account.save();
            const base = getResetBaseUrl();
            const url = new URL("/reset-password", `${base}/`);
            url.searchParams.set("type", type.toLowerCase());
            url.searchParams.set("token", token);
            try { await sendPasswordResetEmail({ to: email.trim().toLowerCase(), url: url.toString() }); }
            catch { account.resetPasswordToken = undefined; account.resetPasswordExpires = undefined; await account.save().catch(() => {}); }
        }
        return res.status(200).json({ message: genericMessage });
    } catch {
        // Keep account existence and delivery/configuration details out of the response.
        return res.status(200).json({ message: genericMessage });
    }
}

export async function resetPassword(req, res) {
    const type = String(req.params.accountType || "").toUpperCase();
    const spec = models[type];
    const { token, password, confirmPassword } = req.body ?? {};
    if (!spec) return res.status(404).json({ message: "Not found" });
    if (typeof token !== "string" || !/^[a-f\d]{64}$/i.test(token)) return res.status(400).json({ message: "Reset link is invalid or expired" });
    if (!passRules(password)) return res.status(400).json({ message: "Password must be at least 8 characters and include an uppercase letter and a number" });
    if (password !== confirmPassword) return res.status(400).json({ message: "Passwords do not match" });
    try {
        const passwordHash = await bcrypt.hash(password, 10);
        const updated = await spec.Model.findOneAndUpdate(
            { resetPasswordToken: hashResetToken(token), resetPasswordExpires: { $gt: new Date() } },
            { $set: { [spec.passwordField]: passwordHash }, $unset: { resetPasswordToken: 1, resetPasswordExpires: 1 } },
            { new: true, runValidators: true },
        );
        if (!updated) return res.status(400).json({ message: "Reset link is invalid or expired" });
        return res.status(200).json({ message: "Password reset successfully. Please sign in." });
    } catch {
        return res.status(500).json({ message: "Password could not be reset. Please try again." });
    }
}
