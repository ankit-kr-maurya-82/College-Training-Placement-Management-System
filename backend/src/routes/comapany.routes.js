import express from "express";
import {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    removeCompany,
    loginCompany,
    registerCompany,
    getCompanyDashboard,
    getCompanyProfile,
    updateCompanyProfile,
} from "../controllers/company.controller.js";
import { authenticateToken, requireActiveCompany } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";
import { closeDrive, createDrive, deleteDrive, getManageDrives, publishDrive, updateDrive } from "../controllers/drive.controller.js";
import { getCompanyNotificationSummary, reprocessCompanyNotifications, retryFailedNotifications } from "../controllers/drive-notification.controller.js";
import { requestPasswordReset, resetPassword } from "../controllers/password-reset.controller.js";
import { passwordResetRateLimit } from "../middlewares/password-reset-rate-limit.middleware.js";
import { resendVerificationEmail, verifyEmail } from "../controllers/email-verification.controller.js";
import { verificationResendRateLimit } from "../middlewares/email-verification-rate-limit.middleware.js";

const router = express.Router();
const companyManagers = [authenticateToken, authorizeRoles("ADMIN", "TPO")];

// The legacy self-registration and login routes remain available.
router.post("/register", registerCompany);
router.post("/login", loginCompany);
router.post("/forgot-password", passwordResetRateLimit, (req, res) => { req.params.accountType = "COMPANY"; return requestPasswordReset(req, res); });
router.post("/reset-password", passwordResetRateLimit, (req, res) => { req.params.accountType = "COMPANY"; return resetPassword(req, res); });
router.post("/verify-email", (req, res) => { req.params.accountType = "COMPANY"; return verifyEmail(req, res); });
router.post("/resend-verification", verificationResendRateLimit, (req, res) => { req.params.accountType = "COMPANY"; return resendVerificationEmail(req, res); });

const companyAccount = [authenticateToken, authorizeRoles("COMPANY"), requireActiveCompany];
router.get("/me/dashboard", ...companyAccount, getCompanyDashboard);
router.get("/me/profile", ...companyAccount, getCompanyProfile);
router.put("/me/profile", ...companyAccount, updateCompanyProfile);
router.get("/me/drives", ...companyAccount, getManageDrives);
router.get("/me/notifications", ...companyAccount, getCompanyNotificationSummary);
router.post("/me/drives", ...companyAccount, createDrive);
router.put("/me/drives/:id", ...companyAccount, updateDrive);
router.delete("/me/drives/:id", ...companyAccount, deleteDrive);
router.patch("/me/drives/:id/publish", ...companyAccount, publishDrive);
router.patch("/me/drives/:id/close", ...companyAccount, closeDrive);
router.post("/me/drives/:id/notify", ...companyAccount, retryFailedNotifications);
router.post("/me/drives/:id/notifications/reprocess", ...companyAccount, reprocessCompanyNotifications);

router.post("/", ...companyManagers, createCompany);
router.get("/", getCompanies);
router.get("/:id", getCompanyById);
router.put("/:id", ...companyManagers, updateCompany);
router.delete("/:id", ...companyManagers, removeCompany);

export default router;
