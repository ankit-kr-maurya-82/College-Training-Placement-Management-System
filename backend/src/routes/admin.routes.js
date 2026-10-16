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

const router = express.Router();
router.use(authenticateToken, authorizeRoles("ADMIN", "TPO"));

router.get("/dashboard/overview", getDashboardOverview);
router.get("/analytics/applications", getApplicationAnalytics);
router.get("/analytics/placements", getPlacementAnalytics);
router.get("/analytics/companies", getCompanyAnalytics);
router.get("/analytics/drives", getDriveAnalytics);
router.get("/students", getAdminStudents);
router.get("/students/:id", getAdminStudentById);
router.patch("/students/:id/status", updateAdminStudentStatus);
router.get("/announcements", listManagedAnnouncements);
router.post("/announcements", createAnnouncement);
router.patch("/announcements/:id/publish", publishAnnouncement);
router.delete("/announcements/:id", deleteAnnouncement);

export default router;
