import express from "express";
import {
    createCompany,
    getCompanies,
    getCompanyById,
    updateCompany,
    removeCompany,
    loginCompany,
    registerCompany,
} from "../controllers/company.controller.js";
import { authenticateToken } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/role.middleware.js";

const router = express.Router();
const companyManagers = [authenticateToken, authorizeRoles("ADMIN", "TPO")];

// The legacy self-registration and login routes remain available.
router.post("/register", registerCompany);
router.post("/login", loginCompany);

router.post("/", ...companyManagers, createCompany);
router.get("/", getCompanies);
router.get("/:id", getCompanyById);
router.put("/:id", ...companyManagers, updateCompany);
router.delete("/:id", ...companyManagers, removeCompany);

export default router;
