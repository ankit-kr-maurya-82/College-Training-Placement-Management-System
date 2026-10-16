import { Application } from "../models/application.model.js";
import { Company } from "../models/company.model.js";
import { Drive } from "../models/drive.model.js";
import { rankRecommendations, recommendationWeights, scoreDriveRecommendation } from "../services/job-recommendation.service.js";

const validId = (value) => typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
const eligibilityStatuses = new Set(["ELIGIBLE", "INCOMPLETE", "NOT_ELIGIBLE"]);
const jobTypes = new Set(["Full-time", "Internship", "Part-time"]);
const workModes = new Set(["On-site", "Hybrid", "Remote"]);

export async function getMyRecommendations(req, res) {
    const studentId = req.user?.studentId;
    if (!validId(studentId)) return res.status(403).json({ message: "A student account is required" });
    const status = req.query.eligibility;
    const sort = req.query.sort ?? "match";
    if (status && !eligibilityStatuses.has(String(status))) return res.status(400).json({ message: "Invalid eligibility filter" });
    if (!new Set(["match", "deadline", "newest"]).has(String(sort))) return res.status(400).json({ message: "sort must be match, deadline, or newest" });
    if (req.query.jobType && !jobTypes.has(String(req.query.jobType))) return res.status(400).json({ message: "Invalid jobType" });
    if (req.query.workMode && !workModes.has(String(req.query.workMode))) return res.status(400).json({ message: "Invalid workMode" });
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search.length > 100) return res.status(400).json({ message: "Search must be 100 characters or fewer" });
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ message: "page must be positive and limit must be between 1 and 100" });

    try {
        const activeCompanies = await Company.find({ isActive: true }).select("_id name companyName").lean();
        const driveFilter = {
            status: "Published",
            applicationDeadline: { $gt: new Date() },
            company: { $in: activeCompanies.map(({ _id }) => _id) },
            ...(req.query.jobType ? { jobType: String(req.query.jobType) } : {}),
            ...(req.query.workMode ? { workMode: String(req.query.workMode) } : {}),
        };
        if (search) {
            const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const expression = new RegExp(escaped, "i");
            const matchingCompanyIds = activeCompanies
                .filter((company) => expression.test(company.name || "") || expression.test(company.companyName || ""))
                .map(({ _id }) => _id);
            driveFilter.$or = [
                { title: expression }, { description: expression }, { location: expression }, { requiredSkills: expression },
                { company: { $in: matchingCompanyIds } },
            ];
        }

        const [drives, applications] = await Promise.all([
            Drive.find(driveFilter).populate("company", "name companyName logo location").lean(),
            Application.find({ student: studentId }).select("drive status").lean(),
        ]);
        const applicationByDrive = new Map(applications.map((application) => [String(application.drive), application]));
        let recommendations = drives.map((drive) => {
            const match = scoreDriveRecommendation(req.studentAccount || {}, drive);
            const application = applicationByDrive.get(String(drive._id));
            return { drive, ...match, applicationStatus: application?.status ?? null };
        });
        if (status) recommendations = recommendations.filter((item) => item.eligibilityStatus === status);
        const ranked = rankRecommendations(recommendations, String(sort));
        const total = ranked.length;
        const start = (page - 1) * limit;
        return res.status(200).json({
            recommendations: ranked.slice(start, start + limit),
            pagination: { page, limit, total, pages: Math.ceil(total / limit) },
            scoring: { weights: recommendationWeights, explanation: "Configured criteria are weighted and normalized across the criteria present on each drive; missing student information scores zero. Skill score is the share of required skills matched." },
            profile: { hasResume: Boolean(req.studentAccount?.resumeUrl) },
        });
    } catch (error) {
        console.error("Job recommendations could not be loaded", { errorName: error?.name || "Error" });
        return res.status(500).json({ message: "Job recommendations could not be loaded" });
    }
}
