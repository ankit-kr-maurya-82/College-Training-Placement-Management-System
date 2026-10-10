import express from "express";
import { authenticateToken, requireActiveStudent, requireActiveStudentOrManager } from "../middlewares/auth.middleware.js";
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

router.post("/", authenticateToken, requireActiveStudent, applyForDrive);
router.get("/my", authenticateToken, requireActiveStudent, getMyApplications);
router.get("/", ...managers, getApplications);
router.get("/:id", authenticateToken, requireActiveStudentOrManager, getApplicationById);
router.patch("/:id/withdraw", authenticateToken, requireActiveStudent, withdrawApplication);
router.patch("/:id/status", ...managers, updateApplicationStatus);

export default router;
