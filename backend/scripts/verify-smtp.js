import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { verifySmtpConnection } from "../src/services/vacancy-email.service.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

try {
    await verifySmtpConnection();
    console.log("SMTP connection verified. No email was sent.");
} catch (error) {
    // Do not print the raw Nodemailer error: keep diagnostics free of credentials.
    const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : "";
    console.error(`SMTP verification failed${code}. Check backend/.env and network access.`);
    process.exitCode = 1;
}
