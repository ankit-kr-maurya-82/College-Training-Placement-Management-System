import { createHash } from "node:crypto";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function hashResetToken(token) {
    return createHash("sha256").update(token).digest("hex");
}

export function getResetBaseUrl() {
    const configured = process.env.FRONTEND_URL;
    if (typeof configured !== "string" || !configured.trim()) throw new Error("Frontend URL is not configured");
    const url = new URL(configured);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname))) {
        throw new Error("Frontend URL is invalid");
    }
    return url.origin;
}

let emailSender = async ({ to, url }) => {
    const { sendPasswordResetEmail } = await import("./vacancy-email.service.js");
    return sendPasswordResetEmail({ to, url });
};

export function setPasswordResetEmailSender(sender) { emailSender = sender; }
export function sendPasswordResetEmail(options) { return emailSender(options); }
export { emailPattern };
