const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) { return typeof email === "string" && emailPattern.test(email.trim()); }
export function getEligibilityExclusionReason(student, eligibility = {}) {
    const hasEducationData = [student.department, student.course].some((value) => typeof value === "string" && value.trim())
        || Number.isInteger(student.graduationYear) && student.graduationYear >= 1900
        || typeof student.cgpa === "number" && Number.isFinite(student.cgpa) && student.cgpa >= 0 && student.cgpa <= 10
        || Number.isInteger(student.activeBacklogs) && student.activeBacklogs >= 0;
    if (!hasEducationData) return "missingEducationData";
    if (eligibility.minCGPA !== undefined && (typeof student.cgpa !== "number" || student.cgpa < eligibility.minCGPA)) return "minCGPA";
    if (eligibility.allowedBranches?.length) {
        const branches = [student.department, student.course].filter(Boolean).map((v) => v.trim().toLowerCase());
        if (!eligibility.allowedBranches.some((v) => branches.includes(v.trim().toLowerCase()))) return "allowedBranches";
    }
    if (eligibility.graduationYear !== undefined && student.graduationYear !== eligibility.graduationYear) return "graduationYear";
    if (eligibility.maxBacklogs !== undefined && (typeof student.activeBacklogs !== "number" || student.activeBacklogs > eligibility.maxBacklogs)) return "maxBacklogs";
    return null;
}
export function isEligibleStudent(student, eligibility = {}) { return getEligibilityExclusionReason(student, eligibility) === null; }

export function getApplyUrl(driveId) {
    const base = process.env.FRONTEND_URL || "http://localhost:5173";
    return `${base.replace(/\/$/, "")}/drives/${encodeURIComponent(String(driveId))}`;
}

function escapeHtml(value = "") {
    return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

export function createVacancyEmail(drive, company, applyUrl) {
    const title = escapeHtml(drive.title);
    const companyName = escapeHtml(company.name || company.companyName || "A hiring company");
    const description = escapeHtml(drive.description).replace(/\n/g, "<br>");
    const skills = (drive.requiredSkills || []).map(escapeHtml).join(", ") || "As described in the role";
    const eligibility = drive.eligibility || {};
    const criteria = [eligibility.minCGPA != null ? `Minimum CGPA: ${escapeHtml(eligibility.minCGPA)}` : "", eligibility.allowedBranches?.length ? `Branches: ${eligibility.allowedBranches.map(escapeHtml).join(", ")}` : "", eligibility.graduationYear ? `Graduation year: ${escapeHtml(eligibility.graduationYear)}` : "", eligibility.maxBacklogs != null ? `Maximum active backlogs: ${escapeHtml(eligibility.maxBacklogs)}` : ""].filter(Boolean).join(" · ") || "See the role description";
    const url = escapeHtml(applyUrl);
    const plainText = [
        `${drive.title} at ${company.name || company.companyName || "our company"}`,
        "",
        drive.description,
        `Location: ${drive.location}`,
        `Package: ${drive.ctc || "Not specified"}`,
        `Eligibility: ${criteria.replaceAll(" · ", "; ")}`,
        `Application deadline: ${new Date(drive.applicationDeadline).toLocaleDateString("en-IN")}`,
        `Apply Now: ${applyUrl}`,
    ].join("\n");
    return {
        subject: `${drive.title} opportunity at ${company.name || company.companyName || "our company"}`,
        html: `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px;margin:auto"><h1 style="color:#173b70">${title}</h1><p>Hello,</p><p>${companyName} is inviting eligible students to apply for this opportunity.</p><p>${description}</p><table style="border-collapse:collapse;width:100%"><tr><td><b>Package</b></td><td>${escapeHtml(drive.ctc || "Not specified")}</td></tr><tr><td><b>Location</b></td><td>${escapeHtml(drive.location)}</td></tr><tr><td><b>Required skills</b></td><td>${skills}</td></tr><tr><td><b>Eligibility</b></td><td>${criteria}</td></tr><tr><td><b>Apply by</b></td><td>${escapeHtml(new Date(drive.applicationDeadline).toLocaleDateString("en-IN"))}</td></tr></table><p style="margin:28px 0"><a href="${url}" style="background:#1d4ed8;color:white;padding:12px 20px;text-decoration:none;border-radius:5px">Apply Now</a></p><p>We look forward to your application.</p></div>`,
        text: plainText,
    };
}

let transportFactory = async (options) => (await import("nodemailer")).createTransport(options);
let cachedTransport;
export function setTransportFactory(factory) { transportFactory = factory; cachedTransport = undefined; }

function getSmtpOptions() {
    const { SMTP_HOST = "smtp.gmail.com", SMTP_PORT = "465", SMTP_USER, SMTP_PASS } = process.env;
    const from = process.env.EMAIL_FROM || process.env.SMTP_FROM || SMTP_USER;
    const port = Number(SMTP_PORT);
    const secureSetting = process.env.SMTP_SECURE?.toLowerCase();
    if (!SMTP_HOST || !Number.isInteger(port) || port < 1 || port > 65535 || !SMTP_USER || !SMTP_PASS || !from || (secureSetting && !["true", "false"].includes(secureSetting))) throw new Error("Email delivery is not configured");
    const secure = secureSetting == null ? port === 465 : secureSetting === "true";
    return { from, options: { host: SMTP_HOST, port, secure, auth: { user: SMTP_USER, pass: SMTP_PASS }, connectionTimeout: 15000, socketTimeout: 30000 } };
}

async function getTransport() {
    const { options } = getSmtpOptions();
    cachedTransport ??= await transportFactory(options);
    return cachedTransport;
}

export async function verifySmtpConnection() {
    const transport = await getTransport();
    return transport.verify();
}

export async function sendVacancyEmail({ to, drive, company, applyUrl }) {
    const { from } = getSmtpOptions();
    const transport = await getTransport();
    return transport.sendMail({ from, to, ...createVacancyEmail(drive, company, applyUrl) });
}
