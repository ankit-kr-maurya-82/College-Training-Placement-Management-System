import express from "express";
import { authenticateToken, requireActiveStudent } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { closeDrive, createDrive, deleteDrive, getDriveById, getDrives, getManageDrives, publishDrive, updateDrive } from "../controllers/drive.controller.js";
import { getMyRecommendations } from "../controllers/recommendation.controller.js";

const router = express.Router();
const managers = [authenticateToken, authorizeRoles("ADMIN", "TPO")];

router.post("/", ...managers, createDrive);
router.get("/manage", ...managers, getManageDrives);
router.get("/recommendations", authenticateToken, requireActiveStudent, getMyRecommendations);
router.get("/", getDrives);
router.get("/:id", getDriveById);
router.put("/:id", ...managers, updateDrive);
router.delete("/:id", ...managers, deleteDrive);
router.patch("/:id/publish", ...managers, publishDrive);
router.patch("/:id/close", ...managers, closeDrive);

export default router;
