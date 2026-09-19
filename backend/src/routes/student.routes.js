

// route of student
import express from "express";
import { registerStudent } from "../controllers/student.controller.js";

const router = express.Router();

router.post("/register", registerStudent);

export default router;