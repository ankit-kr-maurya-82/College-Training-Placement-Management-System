import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { getApplyUrl, isValidEmail, sendVacancyEmail } from "../src/services/vacancy-email.service.js";

dotenv.config({ path: fileURLToPath(new URL("../.env", import.meta.url)) });

const recipients = process.argv.slice(2);
if (recipients.length !== 1 || !isValidEmail(recipients[0])) {
    console.error("Usage: npm run email:test -- <single-test-recipient>");
    process.exit(2);
}

const drive = {
    _id: "smtp-email-test",
    title: "SMTP Test Opportunity",
    description: "This is a manually requested test message.",
    location: "Test location",
    ctc: "Not specified",
    eligibility: { minCGPA: 7, allowedBranches: ["CSE"], graduationYear: 2027, maxBacklogs: 0 },
    applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};
const company = { name: "Placement System Test" };

try {
    await sendVacancyEmail({ to: recipients[0], drive, company, applyUrl: getApplyUrl(drive._id) });
    console.log("One test email sent to the specified recipient.");
} catch (error) {
    const code = typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code) ? ` (${error.code})` : "";
    console.error(`Test email failed${code}. Check SMTP configuration and network access.`);
    process.exitCode = 1;
}
