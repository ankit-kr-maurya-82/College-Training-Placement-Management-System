import express from "express";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
    getAdminStudentById,
    getAdminStudents,
    getApplicationAnalytics,
    getCompanyAnalytics,
    getDashboardOverview,
    getDriveAnalytics,
    getPlacementAnalytics,
    updateAdminStudentStatus,
} from "../controllers/admin.controller.js";
import { createAnnouncement, deleteAnnouncement, listManagedAnnouncements, publishAnnouncement } from "../controllers/announcement.controller.js";
import { getInterviewOversight } from "../controllers/interview.controller.js";
import { getSkillReadinessAnalytics } from "../controllers/skill-readiness.controller.js";
import { getSkillGaps } from "../controllers/skill-gap.controller.js";

const router = express.Router();
router.use(authenticateToken, authorizeRoles("ADMIN", "TPO"));

router.get("/dashboard/overview", getDashboardOverview);
router.get("/analytics/applications", getApplicationAnalytics);
router.get("/analytics/placements", getPlacementAnalytics);
router.get("/analytics/companies", getCompanyAnalytics);
router.get("/analytics/drives", getDriveAnalytics);
router.get("/interviews", getInterviewOversight);
router.get("/analytics/skills", getSkillReadinessAnalytics);
router.get("/analytics/skill-gaps", getSkillGaps);
router.get("/students", getAdminStudents);
router.get("/students/:id", getAdminStudentById);
router.patch("/students/:id/status", updateAdminStudentStatus);
router.get("/announcements", listManagedAnnouncements);
router.post("/announcements", createAnnouncement);
router.patch("/announcements/:id/publish", publishAnnouncement);
router.delete("/announcements/:id", deleteAnnouncement);

export default router;
