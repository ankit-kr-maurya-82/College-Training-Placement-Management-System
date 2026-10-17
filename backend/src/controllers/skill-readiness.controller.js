import { Company } from "../models/company.model.js";
import { Drive } from "../models/drive.model.js";
import { Student } from "../models/student.model.js";
import { buildStudentSkillReadiness, mergeSkillSupplyAndDemand } from "../services/skill-readiness.service.js";

function normalizedSkillStages(field) {
    return [
        { $unwind: `$${field}` },
        { $set: { skillLabel: { $trim: { input: `$${field}` } }, skillKey: { $toLower: { $trim: { input: `$${field}` } } } } },
        { $match: { skillKey: { $ne: "" } } },
    ];
}

function demandPipeline(companyIds) {
    return [
        { $match: { status: "Published", applicationDeadline: { $gt: new Date() }, company: { $in: companyIds } } },
        ...normalizedSkillStages("requiredSkills"),
        { $group: { _id: "$skillKey", skill: { $first: "$skillLabel" }, driveIds: { $addToSet: "$_id" } } },
        { $project: { skill: 1, driveCount: { $size: "$driveIds" } } },
        { $sort: { driveCount: -1, skill: 1 } },
        { $limit: 100 },
    ];
}

export async function getMySkillReadiness(req, res) {
    if (!req.studentAccount?._id) return res.status(404).json({ message: "Student profile not found" });
    try {
        const companies = await Company.find({ isActive: true }).select("_id").lean();
        const drives = await Drive.find({
            status: "Published",
            applicationDeadline: { $gt: new Date() },
            company: { $in: companies.map(({ _id }) => _id) },
        }).select("requiredSkills").lean();
        return res.status(200).json({ readiness: buildStudentSkillReadiness(req.studentAccount.skills ?? [], drives) });
    } catch (error) {
        console.error("Student skill readiness could not be loaded", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Student skill readiness could not be loaded" });
    }
}

export async function getSkillReadinessAnalytics(req, res) {
    try {
        const companies = await Company.find({ isActive: true }).select("_id").lean();
        const companyIds = companies.map(({ _id }) => _id);
        const [activeStudentCount, activeDriveCount, demandGroups, supplyGroups] = await Promise.all([
            Student.countDocuments({ isActive: { $ne: false } }),
            Drive.countDocuments({ status: "Published", applicationDeadline: { $gt: new Date() }, company: { $in: companyIds } }),
            Drive.aggregate(demandPipeline(companyIds)),
            Student.aggregate([
                { $match: { isActive: { $ne: false } } },
                ...normalizedSkillStages("skills"),
                { $group: { _id: { student: "$_id", skill: "$skillKey" }, skillLabel: { $first: "$skillLabel" } } },
                { $group: { _id: "$_id.skill", studentCount: { $sum: 1 }, skill: { $first: "$skillLabel" } } },
            ]),
        ]);
        const skills = mergeSkillSupplyAndDemand(demandGroups, supplyGroups, activeStudentCount);
        return res.status(200).json({
            activeStudentCount,
            activeDriveCount,
            skills,
            note: "Counts use active student profiles and current published drives at active companies. Skill names are matched exactly after trimming and lowercasing; counts do not measure proficiency or academic eligibility.",
        });
    } catch (error) {
        console.error("Skill readiness analytics could not be loaded", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Skill readiness analytics could not be loaded" });
    }
}
