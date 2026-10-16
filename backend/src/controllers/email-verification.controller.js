import { Student } from "../models/student.model.js";
import { Company } from "../models/company.model.js";
import { emailPattern, hashResetToken } from "../services/password-reset.service.js";
import { createVerificationToken, createVerificationUrl, requiresEmailVerification, sendVerificationEmail } from "../services/email-verification.service.js";

const accounts = {
    STUDENT: { Model: Student, emailField: "email", label: "student" },
    COMPANY: { Model: Company, emailField: "hrEmail", label: "company" },
};
const genericResendMessage = "If the account is eligible for verification, an email will be sent shortly.";

export async function resendVerificationEmail(req, res) {
    const type = String(req.params.accountType || "").toUpperCase();
    const spec = accounts[type];
    const email = req.body?.email;
    if (!spec) return res.status(404).json({ message: "Not found" });
    if (typeof email !== "string" || !emailPattern.test(email.trim())) return res.status(400).json({ message: "A valid email is required" });
    try {
        const account = await spec.Model.findOne({ [spec.emailField]: email.trim().toLowerCase() });
        if (account && requiresEmailVerification(account)) {
            const { token, tokenHash, expires } = createVerificationToken();
            account.emailVerificationToken = tokenHash;
            account.emailVerificationExpires = expires;
            await account.save();
            try {
                await sendVerificationEmail({ to: email.trim().toLowerCase(), url: createVerificationUrl(type, token) });
            } catch {
                account.emailVerificationToken = undefined;
                account.emailVerificationExpires = undefined;
                await account.save().catch(() => {});
            }
        }
        return res.status(200).json({ message: genericResendMessage });
    } catch {
        return res.status(200).json({ message: genericResendMessage });
    }
}

export async function verifyEmail(req, res) {
    const type = String(req.params.accountType || "").toUpperCase();
    const spec = accounts[type];
    const { token } = req.body ?? {};
    if (!spec) return res.status(404).json({ message: "Not found" });
    if (typeof token !== "string" || !/^[a-f\d]{64}$/i.test(token)) return res.status(400).json({ message: "Verification link is invalid, expired, or already used." });
    try {
        const account = await spec.Model.findOneAndUpdate(
            { emailVerificationToken: hashResetToken(token), emailVerificationExpires: { $gt: new Date() }, isEmailVerified: { $ne: true } },
            { $set: { isEmailVerified: true }, $unset: { emailVerificationToken: 1, emailVerificationExpires: 1 } },
            { new: true, runValidators: true },
        );
        if (!account) return res.status(400).json({ message: "Verification link is invalid, expired, or already used. Request a new link if needed." });
        return res.status(200).json({ message: `${spec.label === "student" ? "Student" : "Company"} email verified successfully. You can now log in.` });
    } catch {
        return res.status(500).json({ message: "Email could not be verified. Please try again." });
    }
}
