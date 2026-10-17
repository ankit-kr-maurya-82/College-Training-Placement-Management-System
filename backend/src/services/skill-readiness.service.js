function normalizeSkill(value) {
    return typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
}

export function buildStudentSkillReadiness(studentSkills = [], drives = []) {
    const owned = new Set(studentSkills.map(normalizeSkill).filter(Boolean));
    const demand = new Map();
    let totalDemandOccurrences = 0;
    let matchedDemandOccurrences = 0;

    for (const drive of drives) {
        const required = new Map();
        for (const label of drive.requiredSkills ?? []) {
            const key = normalizeSkill(label);
            if (key && !required.has(key)) required.set(key, label.trim());
        }
        for (const [key, label] of required) {
            totalDemandOccurrences += 1;
            if (owned.has(key)) matchedDemandOccurrences += 1;
            const entry = demand.get(key) ?? { skill: label, driveCount: 0, matched: owned.has(key) };
            entry.driveCount += 1;
            demand.set(key, entry);
        }
    }

    const missingSkills = [...demand.entries()]
        .filter(([key]) => !owned.has(key))
        .map(([, value]) => ({ skill: value.skill, driveCount: value.driveCount }))
        .sort((a, b) => b.driveCount - a.driveCount || a.skill.localeCompare(b.skill));

    return {
        profileSkillCount: owned.size,
        activeDriveCount: drives.length,
        drivesWithSkillRequirements: drives.filter((drive) => (drive.requiredSkills ?? []).some((skill) => normalizeSkill(skill))).length,
        matchedDemandOccurrences,
        totalDemandOccurrences,
        skillCoveragePercentage: totalDemandOccurrences ? Number((matchedDemandOccurrences / totalDemandOccurrences * 100).toFixed(1)) : null,
        missingSkills: missingSkills.slice(0, 10),
        note: "Coverage compares exact skill names (case-insensitive) in your profile with skills listed on currently open published drives. It does not measure proficiency or determine academic eligibility.",
    };
}

export function mergeSkillSupplyAndDemand(requiredGroups = [], suppliedGroups = [], activeStudentCount = 0) {
    const supplied = new Map(suppliedGroups.map((row) => [row._id, row.studentCount]));
    return requiredGroups
        .map((row) => {
            const studentsWithSkill = supplied.get(row._id) ?? 0;
            return {
                skill: row.skill,
                driveCount: row.driveCount,
                studentsWithSkill,
                activeStudentsMissingSkill: Math.max(0, activeStudentCount - studentsWithSkill),
            };
        })
        .sort((a, b) => b.driveCount - a.driveCount || b.activeStudentsMissingSkill - a.activeStudentsMissingSkill || a.skill.localeCompare(b.skill));
}
