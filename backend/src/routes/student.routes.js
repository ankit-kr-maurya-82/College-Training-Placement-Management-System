

// route of student
import express from "express";
import { registerStudent, showStudents, deleteStudent, loginStudents } from "../controllers/student.controller.js";

const router = express.Router();

router.post("/register", registerStudent);
router.post("/login", loginStudents);
router.get("/register", showStudents);
router.get("/", showStudents);
router.delete("/:id", deleteStudent);

export default router;
