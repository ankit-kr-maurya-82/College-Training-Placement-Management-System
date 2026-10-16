import { randomBytes } from "node:crypto";
import { getResetBaseUrl, hashResetToken } from "./password-reset.service.js";

let emailSender = async ({ to, url }) => {
    const { sendEmailVerification } = await import("./vacancy-email.service.js");
    return sendEmailVerification({ to, url });
};

export function setVerificationEmailSender(sender) { emailSender = sender; }
export function sendVerificationEmail(options) { return emailSender(options); }
export function requiresEmailVerification(account) {
    if (account?.isEmailVerified !== false) return false;
    return !(typeof account.$isDefault === "function" && account.$isDefault("isEmailVerified"));
}

export function createVerificationToken() {
    const token = randomBytes(32).toString("hex");
    return { token, tokenHash: hashResetToken(token), expires: new Date(Date.now() + 24 * 60 * 60 * 1000) };
}

export function createVerificationUrl(type, token) {
    const url = new URL("/verify-email", `${getResetBaseUrl()}/`);
    url.searchParams.set("type", type.toLowerCase());
    url.searchParams.set("token", token);
    return url.toString();
}
