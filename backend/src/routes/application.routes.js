import express from "express";
import { authenticateToken, requireActiveCompany, requireActiveStudent, requireActiveStudentOrManager } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import {
    applyForDrive,
    getApplicationById,
    getApplications,
    getMyApplications,
    updateApplicationStatus,
    withdrawApplication,
} from "../controllers/application.controller.js";

const router = express.Router();
const managers = [authenticateToken, authorizeRoles("ADMIN", "TPO")];
const reviewers = [authenticateToken, authorizeRoles("ADMIN", "TPO", "COMPANY"), (req, res, next) => String(req.user?.role).toUpperCase() === "COMPANY" ? requireActiveCompany(req, res, next) : next()];

router.post("/", authenticateToken, requireActiveStudent, applyForDrive);
router.get("/my", authenticateToken, requireActiveStudent, getMyApplications);
router.get("/", ...reviewers, getApplications);
router.get("/:id", authenticateToken, requireActiveStudentOrManager, getApplicationById);
router.patch("/:id/withdraw", authenticateToken, requireActiveStudent, withdrawApplication);
router.patch("/:id/status", ...reviewers, updateApplicationStatus);

export default router;
