import { assessApplicationEligibility } from "./application-eligibility.service.js";

export const recommendationWeights = Object.freeze({ skills: 40, branches: 20, minCGPA: 20, graduationYear: 10, maxBacklogs: 10 });
const weights = recommendationWeights;

function normalizedSkills(values = []) {
    return new Set(values.filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim().toLowerCase()));
}

export function scoreDriveRecommendation(student, drive) {
    const matchedRequirements = [];
    const missingRequirements = [];
    let weightedMatch = 0;
    let availableWeight = 0;
    const eligibility = drive.eligibility || {};
    const assessment = assessApplicationEligibility(student, eligibility);

    const branchCheck = assessment.checks.find(({ key }) => key === "allowedBranches");
    if (branchCheck) {
        availableWeight += weights.branches;
        if (branchCheck.state === "matched") {
            weightedMatch += weights.branches;
            matchedRequirements.push(branchCheck.label);
        } else missingRequirements.push(branchCheck.state === "incomplete" ? `${branchCheck.label} (add your department or course)` : branchCheck.label);
    }

    for (const key of ["minCGPA", "graduationYear", "maxBacklogs"]) {
        const check = assessment.checks.find((item) => item.key === key);
        if (!check) continue;
        availableWeight += weights[key];
        if (check.state === "matched") {
            weightedMatch += weights[key];
            matchedRequirements.push(check.label);
        } else {
            const missingInfo = check.state === "incomplete";
            const profileHint = key === "minCGPA" ? "add your CGPA" : key === "graduationYear" ? "add your graduation year" : "add your active backlog count";
            missingRequirements.push(missingInfo ? `${check.label} (${profileHint})` : check.label);
        }
    }

    const requiredSkills = [...new Set((drive.requiredSkills || []).filter((value) => typeof value === "string" && value.trim()).map((value) => value.trim()))];
    if (requiredSkills.length) {
        const studentSkills = normalizedSkills(student.skills);
        const matchedSkills = requiredSkills.filter((skill) => studentSkills.has(skill.toLowerCase()));
        weightedMatch += weights.skills * matchedSkills.length / requiredSkills.length;
        availableWeight += weights.skills;
        matchedRequirements.push(...matchedSkills.map((skill) => `Skill: ${skill}`));
        missingRequirements.push(...requiredSkills.filter((skill) => !studentSkills.has(skill.toLowerCase())).map((skill) => `Skill: ${skill}`));
    }

    return {
        matchScore: availableWeight ? Math.round(weightedMatch / availableWeight * 100) : null,
        eligibilityStatus: assessment.status,
        matchedRequirements,
        missingRequirements,
    };
}

export function rankRecommendations(recommendations, sort = "match") {
    const copy = [...recommendations];
    const deadline = (item) => new Date(item.drive.applicationDeadline).getTime();
    const createdAt = (item) => new Date(item.drive.createdAt || 0).getTime();
    const id = (item) => String(item.drive._id);
    if (sort === "deadline") return copy.sort((a, b) => deadline(a) - deadline(b) || (b.matchScore ?? -1) - (a.matchScore ?? -1) || id(a).localeCompare(id(b)));
    if (sort === "newest") return copy.sort((a, b) => createdAt(b) - createdAt(a) || (b.matchScore ?? -1) - (a.matchScore ?? -1) || id(a).localeCompare(id(b)));
    return copy.sort((a, b) => (b.matchScore ?? -1) - (a.matchScore ?? -1) || deadline(a) - deadline(b) || id(a).localeCompare(id(b)));
}
