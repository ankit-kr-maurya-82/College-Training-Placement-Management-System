

// route of student
import express from "express";
import { registerStudent, showStudents, deleteStudent, loginStudents } from "../controllers/student.controller.js";
import { getMyStudentProfile, updateMyStudentProfile } from "../controllers/student-profile.controller.js";
import { authenticateToken, requireActiveStudent } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudents);
router.get("/me/profile", authenticateToken, requireActiveStudent, getMyStudentProfile);
router.put("/me/profile", authenticateToken, requireActiveStudent, updateMyStudentProfile);
router.get("/register", showStudents);
router.get("/", showStudents);
router.delete("/:id", deleteStudent);

export default router;
