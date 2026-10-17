

// route of student
import express from "express";
import { registerStudent, showStudents, deleteStudent, loginStudents } from "../controllers/student.controller.js";
import { getMyStudentProfile, updateMyStudentProfile } from "../controllers/student-profile.controller.js";
import { authenticateToken, requireActiveStudent } from "../middlewares/auth.middleware.js";
import { requestPasswordReset, resetPassword } from "../controllers/password-reset.controller.js";
import { passwordResetRateLimit } from "../middlewares/password-reset-rate-limit.middleware.js";
import { resendVerificationEmail, verifyEmail } from "../controllers/email-verification.controller.js";
import { verificationResendRateLimit } from "../middlewares/email-verification-rate-limit.middleware.js";
import { receiveProfilePicture } from "../middlewares/profile-picture-upload.middleware.js";
import { uploadStudentProfilePicture } from "../controllers/profile-picture.controller.js";
import { listStudentInterviews } from "../controllers/interview.controller.js";
import { listStudentAnnouncements } from "../controllers/announcement.controller.js";
import { getMySkillReadiness } from "../controllers/skill-readiness.controller.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudents);
router.post("/forgot-password", passwordResetRateLimit, (req, res) => { req.params.accountType = "STUDENT"; return requestPasswordReset(req, res); });
router.post("/reset-password", passwordResetRateLimit, (req, res) => { req.params.accountType = "STUDENT"; return resetPassword(req, res); });
router.post("/verify-email", (req, res) => { req.params.accountType = "STUDENT"; return verifyEmail(req, res); });
router.post("/resend-verification", verificationResendRateLimit, (req, res) => { req.params.accountType = "STUDENT"; return resendVerificationEmail(req, res); });
router.get("/me/profile", authenticateToken, requireActiveStudent, getMyStudentProfile);
router.put("/me/profile", authenticateToken, requireActiveStudent, updateMyStudentProfile);
router.post("/me/profile-picture", authenticateToken, requireActiveStudent, receiveProfilePicture, uploadStudentProfilePicture);
router.get("/me/interviews", authenticateToken, requireActiveStudent, listStudentInterviews);
router.get("/me/readiness", authenticateToken, requireActiveStudent, getMySkillReadiness);
router.get("/announcements", authenticateToken, requireActiveStudent, listStudentAnnouncements);
router.get("/register", showStudents);
router.get("/", showStudents);
router.delete("/:id", deleteStudent);

export default router;
