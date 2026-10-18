import { Company } from "../models/company.model.js";
import { Drive } from "../models/drive.model.js";
import { Student } from "../models/student.model.js";
import { mergeSkillSupplyAndDemand } from "../services/skill-readiness.service.js";

/**
 * GET /admin/skill-gaps
 * Returns aggregated skill gap data for ADMIN/TPO.
 * Query parameters:
 *  - minDrives: minimum number of drives requiring the skill (default 0)
 *  - minStudents: minimum number of students with the skill (default 0)
 *  - search: case-insensitive substring match on skill name
 *  - limit: number of results to return (default 10, max 100)
 */
export async function getSkillGaps(req, res) {
    const query = req.query || {};
    // Parse and validate query parameters
    const minDrives = Number(query.minDrives ?? 0);
    const minStudents = Number(query.minStudents ?? 0);
    const limit = Number(query.limit ?? 10);
    const search = typeof query.search === "string" ? query.search.trim() : "";
// duplicate query parsing removed

    if (!Number.isInteger(minDrives) || minDrives < 0) {
        return res.status(400).json({ message: "minDrives must be a non‑negative integer" });
    }
    if (!Number.isInteger(minStudents) || minStudents < 0) {
        return res.status(400).json({ message: "minStudents must be a non‑negative integer" });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "limit must be between 1 and 100" });
    }

    try {
        // Load active companies
        const companies = await Company.find({ isActive: true }).select("_id").lean();
        const companyIds = companies.map(c => c._id);
        // Active student count for missing‑skill calculation
        const activeStudentCount = await Student.countDocuments({ isActive: { $ne: false } });

        // Aggregate demand (required skills) from open published drives
        const demandPipeline = [
            { $match: { status: "Published", applicationDeadline: { $gt: new Date() }, company: { $in: companyIds } } },
            { $unwind: "$requiredSkills" },
            {
                $set: {
                    skillLabel: { $trim: { input: "$requiredSkills" } },
                    skillKey: { $toLower: { $trim: { input: "$requiredSkills" } } }
                }
            },
            { $match: { skillKey: { $ne: "" } } },
            { $group: { _id: "$skillKey", skill: { $first: "$skillLabel" }, driveIds: { $addToSet: "$_id" } } },
            { $project: { skill: 1, driveCount: { $size: "$driveIds" } } }
        ];
        const demandGroups = await Drive.aggregate(demandPipeline);

        // Aggregate supply (student skills)
        const supplyPipeline = [
            { $match: { isActive: { $ne: false } } },
            { $unwind: "$skills" },
            {
                $set: {
                    skillLabel: { $trim: { input: "$skills" } },
                    skillKey: { $toLower: { $trim: { input: "$skills" } } }
                }
            },
            { $match: { skillKey: { $ne: "" } } },
            { $group: { _id: { student: "$_id", skill: "$skillKey" }, skillLabel: { $first: "$skillLabel" } } },
            { $group: { _id: "$_id.skill", studentCount: { $sum: 1 }, skill: { $first: "$skillLabel" } } }
        ];
        const supplyGroups = await Student.aggregate(supplyPipeline);

        // Merge demand and supply
        let skills = mergeSkillSupplyAndDemand(demandGroups, supplyGroups, activeStudentCount);

        // Apply filters
        if (search) {
            const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            skills = skills.filter(row => regex.test(row.skill));
        }
        if (minDrives) {
            skills = skills.filter(row => row.driveCount >= minDrives);
        }
        if (minStudents) {
            skills = skills.filter(row => row.studentsWithSkill >= minStudents);
        }
        // Sort deterministic: driveCount desc, missingSkill desc, skill asc (already done in service)
        skills = skills.slice(0, limit);

        const responseFilters = { minDrives, minStudents, limit };
        if (search) responseFilters.search = search;
        return res.status(200).json({
            filters: responseFilters,
            skillGaps: skills,
            note: "Counts use active student profiles and currently open published drives. No personal identifiers are returned."
        });
    } catch (error) {
        console.error("Skill gaps could not be loaded", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Skill gaps could not be loaded" });
    }
}
