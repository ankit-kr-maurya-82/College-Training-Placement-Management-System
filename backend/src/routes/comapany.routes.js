import express from "express";
import { loginCompany, registerCompany, deleteCompany} from "../controllers/company.controller.js";

const router = express.Router();

router.post("/register", registerCompany);
router.post("/login", loginCompany);
router.delete("/:companyId", deleteCompany)

export default router;