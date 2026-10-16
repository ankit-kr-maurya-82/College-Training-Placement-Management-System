export function assessApplicationEligibility(student = {}, eligibility = {}) {
    const checks = [];
    const add = (key, label, state, message) => checks.push({ key, label, state, message });

    if (eligibility.minCGPA !== undefined) {
        if (typeof student.cgpa !== "number" || !Number.isFinite(student.cgpa)) add("minCGPA", `Minimum CGPA: ${eligibility.minCGPA}`, "incomplete", "You do not meet the minimum CGPA requirement");
        else if (student.cgpa < eligibility.minCGPA) add("minCGPA", `Minimum CGPA: ${eligibility.minCGPA}`, "unmet", "You do not meet the minimum CGPA requirement");
        else add("minCGPA", `Minimum CGPA: ${eligibility.minCGPA}`, "matched");
    }

    if (eligibility.allowedBranches?.length) {
        const branches = [student.department, student.course].filter((value) => typeof value === "string" && value.trim());
        const matchingBranch = branches.find((branch) => eligibility.allowedBranches.some((allowed) => typeof allowed === "string" && branch.trim().toLowerCase() === allowed.trim().toLowerCase()));
        if (!branches.length) add("allowedBranches", `Eligible branches: ${eligibility.allowedBranches.join(", ")}`, "incomplete", "Your branch is not eligible for this drive");
        else if (!matchingBranch) add("allowedBranches", `Eligible branches: ${eligibility.allowedBranches.join(", ")}`, "unmet", "Your branch is not eligible for this drive");
        else add("allowedBranches", `Branch: ${matchingBranch}`, "matched");
    }

    if (eligibility.graduationYear !== undefined) {
        if (!Number.isInteger(student.graduationYear)) add("graduationYear", `Graduation year: ${eligibility.graduationYear}`, "incomplete", "Your graduation year is not eligible for this drive");
        else if (student.graduationYear !== eligibility.graduationYear) add("graduationYear", `Graduation year: ${eligibility.graduationYear}`, "unmet", "Your graduation year is not eligible for this drive");
        else add("graduationYear", `Graduation year: ${eligibility.graduationYear}`, "matched");
    }

    if (eligibility.maxBacklogs !== undefined) {
        if (!Number.isInteger(student.activeBacklogs)) add("maxBacklogs", `Maximum active backlogs: ${eligibility.maxBacklogs}`, "incomplete", "You do not meet the backlog requirement");
        else if (student.activeBacklogs > eligibility.maxBacklogs) add("maxBacklogs", `Maximum active backlogs: ${eligibility.maxBacklogs}`, "unmet", "You do not meet the backlog requirement");
        else add("maxBacklogs", `Active backlogs: ${student.activeBacklogs} (maximum ${eligibility.maxBacklogs})`, "matched");
    }

    const hasUnmet = checks.some(({ state }) => state === "unmet");
    const hasIncomplete = checks.some(({ state }) => state === "incomplete");
    return {
        status: hasUnmet ? "NOT_ELIGIBLE" : hasIncomplete ? "INCOMPLETE" : "ELIGIBLE",
        checks,
        error: checks.find(({ state }) => state === "incomplete" || state === "unmet")?.message ?? null,
    };
}

export function checkApplicationEligibility(student, eligibility = {}) {
    return assessApplicationEligibility(student, eligibility).error;
}
