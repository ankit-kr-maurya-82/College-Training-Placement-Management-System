import { Resume } from "../models/resume.model.js";

const SKILL_ALIASES = {
    javascript: ["js", "javascript", "ecmascript"],
    typescript: ["ts", "typescript"],
    "node.js": ["node", "nodejs", "node.js"],
    postgresql: ["postgres", "postgresql", "psql"],
    python: ["python", "py"],
    "c++": ["c++", "cpp"],
    java: ["java"],
    "c++": ["c++", "cpp"],
    react: ["react", "reactjs", "react.js"],
    mongodb: ["mongodb", "mongo"],
    mysql: ["mysql"],
    git: ["git", "github"],
    docker: ["docker"],
    aws: ["aws", "amazon web services"],
};

const TECHNICAL_SKILLS = Object.keys(SKILL_ALIASES);

function normalizeText(text) { return String(text || "").toLowerCase(); }

function detectSkills(text) {
    const normalized = normalizeText(text);
    const found = new Set();
    for (const skill of TECHNICAL_SKILLS) {
        for (const alias of SKILL_ALIASES[skill]) {
            const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`, "i");
            if (regex.test(normalized)) found.add(skill);
        }
    }
    return Array.from(found);
}

export function analyzeResumeText(text) {
    const skills = detectSkills(text);
    const hasEducation = /education|bachelor|master|degree|university|college/i.test(text);
    const hasProjects = /project/i.test(text);
    const hasExperience = /experience|intern|worked/i.test(text);
    const hasCertifications = /certif/i.test(text);
    const hasAchievements = /achiev|award/i.test(text);

    const dimensions = {
        contact: { score: 5, max: 10, explanation: "Basic profile completeness assumed", recommendations: ["Add contact details and links."] },
        education: { score: hasEducation ? 15 : 0, max: 15, explanation: hasEducation ? "Education detected" : "No education detected", recommendations: hasEducation ? [] : ["Add education details."] },
        skills: { score: Math.min(20, skills.length * 4), max: 20, explanation: `${skills.length} skills detected`, recommendations: skills.length ? [] : ["Add technical skills."] },
        projects: { score: hasProjects ? 20 : 0, max: 20, explanation: hasProjects ? "Projects detected" : "No projects detected", recommendations: hasProjects ? [] : ["Add project details."] },
        experience: { score: hasExperience ? 15 : 0, max: 15, explanation: hasExperience ? "Experience detected" : "No experience detected", recommendations: hasExperience ? [] : ["Add work experience."] },
        certifications: { score: hasCertifications || hasAchievements ? 10 : 0, max: 10, explanation: "Certifications/achievements scan", recommendations: hasCertifications ? [] : ["Add certifications if applicable."] },
        contentQuality: { score: text.length > 500 ? 10 : 5, max: 10, explanation: "Content length heuristic", recommendations: ["Add measurable outcomes."] },
    };
    const total = Object.values(dimensions).reduce((sum, d) => sum + d.score, 0);
    return {
        technicalSkills: skills,
        softSkills: [],
        education: hasEducation ? ["Education detected"] : [],
        projects: hasProjects ? ["Projects detected"] : [],
        experience: hasExperience ? ["Experience detected"] : [],
        certifications: hasCertifications ? ["Certifications detected"] : [],
        achievements: hasAchievements ? ["Achievements detected"] : [],
        dimensions,
        overallScore: total,
        suggestions: Object.values(dimensions).flatMap((d) => d.recommendations),
    };
}

export async function analyzeStoredResume(resume) {
    if (!resume) return { status: "FAILED", errorCode: "RESUME_NOT_FOUND" };
    if (resume.extractionStatus !== "SUCCESS") return { status: "SKIPPED", errorCode: resume.extractionStatus || "NOT_READY" };
    // extractedText not selected by default; caller must fetch with select
    return { status: "SUCCESS", analysis: analyzeResumeText("") };
}
