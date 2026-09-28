import express from "express";
import { loginCompany, registerCompany} from "../controllers/company.controller.js";

const router = express.Router();

router.post("/register", registerCompany);
router.post("/login", loginCompany);

export default router;