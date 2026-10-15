const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) { return typeof email === "string" && emailPattern.test(email.trim()); }
export function isEligibleStudent(student, eligibility = {}) {
    if (eligibility.minCGPA !== undefined && (typeof student.cgpa !== "number" || student.cgpa < eligibility.minCGPA)) return false;
    if (eligibility.allowedBranches?.length) {
        const branches = [student.department, student.course].filter(Boolean).map((v) => v.trim().toLowerCase());
        if (!eligibility.allowedBranches.some((v) => branches.includes(v.trim().toLowerCase()))) return false;
    }
    if (eligibility.graduationYear !== undefined && student.graduationYear !== eligibility.graduationYear) return false;
    if (eligibility.maxBacklogs !== undefined && (typeof student.activeBacklogs !== "number" || student.activeBacklogs > eligibility.maxBacklogs)) return false;
    return true;
}

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
    return {
        subject: `${drive.title} opportunity at ${company.name || company.companyName || "our company"}`,
        html: `<div style="font-family:Arial,sans-serif;color:#1f2937;max-width:640px;margin:auto"><h1 style="color:#173b70">${title}</h1><p>Hello,</p><p>${companyName} is inviting eligible students to apply for this opportunity.</p><p>${description}</p><table style="border-collapse:collapse;width:100%"><tr><td><b>Package</b></td><td>${escapeHtml(drive.ctc || "Not specified")}</td></tr><tr><td><b>Location</b></td><td>${escapeHtml(drive.location)}</td></tr><tr><td><b>Required skills</b></td><td>${skills}</td></tr><tr><td><b>Eligibility</b></td><td>${criteria}</td></tr><tr><td><b>Apply by</b></td><td>${escapeHtml(new Date(drive.applicationDeadline).toLocaleDateString("en-IN"))}</td></tr></table><p style="margin:28px 0"><a href="${url}" style="background:#1d4ed8;color:white;padding:12px 20px;text-decoration:none;border-radius:5px">Apply Now</a></p><p>We look forward to your application.</p></div>`,
    };
}

let transportFactory = async (options) => (await import("nodemailer")).createTransport(options);
export function setTransportFactory(factory) { transportFactory = factory; }

export async function sendVacancyEmail({ to, drive, company, applyUrl }) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) throw new Error("Email delivery is not configured");
    const transporter = await transportFactory({ host: SMTP_HOST, port: Number(SMTP_PORT), secure: Number(SMTP_PORT) === 465, auth: { user: SMTP_USER, pass: SMTP_PASS } });
    return transporter.sendMail({ from: SMTP_FROM, to, ...createVacancyEmail(drive, company, applyUrl) });
}
