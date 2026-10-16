import {Company} from '../models/company.model.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Drive } from '../models/drive.model.js';
import { Application } from '../models/application.model.js';
import { createVerificationToken, createVerificationUrl, requiresEmailVerification, sendVerificationEmail } from "../services/email-verification.service.js";

const companyFields = ["name", "description", "website", "location", "industry", "hrEmail", "hrContact", "logo", "isActive"];
const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validUrl = /^https?:\/\/.+/i;
const validId = (id) => /^[a-f\d]{24}$/i.test(id);

function validateCompanyInput(body, { partial = false } = {}) {
    const input = {};
    for (const field of companyFields) {
        if (Object.hasOwn(body, field)) input[field] = body[field];
    }
    for (const field of ["name", "location", "industry"]) {
        if ((!partial || Object.hasOwn(input, field)) && (typeof input[field] !== "string" || !input[field].trim())) {
            return { error: `${field} is required` };
        }
    }
    for (const field of ["name", "description", "website", "location", "industry", "hrEmail", "hrContact", "logo"]) {
        if (Object.hasOwn(input, field)) {
            if (typeof input[field] !== "string") return { error: `${field} must be a string` };
            input[field] = input[field].trim();
        }
    }
    if (input.website && !validUrl.test(input.website)) return { error: "Website must be a valid URL" };
    if (input.hrEmail) {
        input.hrEmail = input.hrEmail.toLowerCase();
        if (!validEmail.test(input.hrEmail)) return { error: "HR email must be valid" };
    }
    if (Object.hasOwn(input, "isActive") && typeof input.isActive !== "boolean") return { error: "isActive must be a boolean" };
    if (!Object.keys(input).length) return { error: "At least one company field is required" };
    return { input };
}

function publicCompany(company) {
    if (!company) return company;
    const result = typeof company.toObject === "function" ? company.toObject() : { ...company };
    delete result.hrPassword;
    return result;
}

const createCompany = async (req, res) => {
    const { input, error } = validateCompanyInput(req.body ?? {});
    if (error) return res.status(400).json({ message: error });
    try {
        const createdBy = req.user?.userId ?? req.user?._id ?? req.user?.sub;
        const company = await Company.create({ ...input, ...(createdBy ? { createdBy } : {}) });
        return res.status(201).json({ message: "Company created successfully", company: publicCompany(company) });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: "A company with this HR email already exists" });
        if (err.name === "ValidationError" || err.name === "CastError") return res.status(400).json({ message: "Invalid company data" });
        console.error("Error creating company:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getCompanies = async (req, res) => {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 10);
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ message: "page must be positive and limit must be between 1 and 100" });
    }
    try {
        const filter = {};
        if (req.query.industry) filter.industry = { $regex: String(req.query.industry), $options: "i" };
        if (req.query.location) filter.location = { $regex: String(req.query.location), $options: "i" };
        if (req.query.search) {
            const term = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            filter.$or = ["name", "description", "industry", "location"].map((field) => ({ [field]: { $regex: term, $options: "i" } }));
        }
        const [companies, total] = await Promise.all([
            Company.find(filter).select("-hrPassword").sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Company.countDocuments(filter),
        ]);
        return res.status(200).json({ companies, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    } catch (err) {
        console.error("Error retrieving companies:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getCompanyById = async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid company ID" });
    try {
        const company = await Company.findById(req.params.id).select("-hrPassword").lean();
        if (!company) return res.status(404).json({ message: "Company not found" });
        return res.status(200).json({ company });
    } catch (err) {
        console.error("Error retrieving company:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const updateCompany = async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid company ID" });
    const { input, error } = validateCompanyInput(req.body ?? {}, { partial: true });
    if (error) return res.status(400).json({ message: error });
    try {
        const company = await Company.findByIdAndUpdate(req.params.id, { $set: input }, { returnDocument: "after", runValidators: true }).select("-hrPassword").lean();
        if (!company) return res.status(404).json({ message: "Company not found" });
        return res.status(200).json({ message: "Company updated successfully", company });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ message: "A company with this HR email already exists" });
        if (err.name === "ValidationError" || err.name === "CastError") return res.status(400).json({ message: "Invalid company data" });
        console.error("Error updating company:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const removeCompany = async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ message: "Invalid company ID" });
    try {
        const company = await Company.findByIdAndDelete(req.params.id);
        if (!company) return res.status(404).json({ message: "Company not found" });
        return res.status(200).json({ message: "Company deleted successfully" });
    } catch (err) {
        console.error("Error deleting company:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

const registerCompany = async(req, res) => {
    try{
        const {
            companyName,
            hrName,
            hrEmail,
            hrPassword,
            hrPhoneNumber,
            location,
            website,
            description
        } = req.body ?? {};

        if(typeof companyName !== "string" || !companyName.trim()){
            return res.status(400)
            .json(
                {
                    message: "Company name is required",
                }
            )
        }
        if(typeof hrName !== "string" || !hrName.trim()){
            return res.status(400)
            .json(
                {
                    message: "HR name is required",
                }
            )
        }
        if(typeof hrEmail !== "string" || !hrEmail.trim()){
            return res.status(400)
            .json(
                {
                    message: "HR email is required",
                }
            )
        }
        if(typeof hrPassword !== "string" || !hrPassword.trim()){
            return res.status(400)
            .json(
                {
                    message: "HR password is required",
                }
            )
        }
        if(typeof hrPhoneNumber !== "string" || !hrPhoneNumber.trim()){
            return res.status(400)
            .json(
                {
                    message: "HR phone number is required",
                }
            )
        }
        if(typeof location !== "string" || !location.trim()){
            return res.status(400)
            .json(
                {
                    message: "Location is required",
                }
            )
        }
        if(typeof website !== "string" || !website.trim()){
            return res.status(400)
            .json(
                {
                    message: "Website is required",
                }
            )
        }
        if(typeof description !== "string" || !description.trim()){
            return res.status(400)
            .json(
                {
                    message: "Description is required",
                }
            )
        }
        const normalizedEmail = hrEmail.trim().toLowerCase();
        const existingCompany = await Company.findOne({hrEmail: normalizedEmail});
        if(existingCompany){
            return res.status(400).json({message: "HR email already exists"});
        }

        const verification = createVerificationToken();
        const company = await Company.create({
            companyName: companyName.trim(),
            hrName: hrName.trim(),
            hrEmail: normalizedEmail,
            hrPassword: await bcrypt.hash(hrPassword.trim(), 10),
            hrPhoneNumber: hrPhoneNumber.trim(),
            location: location.trim(),
            website: website.trim(),
            description: description.trim(),
            isEmailVerified: false,
            emailVerificationToken: verification.tokenHash,
            emailVerificationExpires: verification.expires,
        });

        try {
            await sendVerificationEmail({ to: company.hrEmail, url: createVerificationUrl("COMPANY", verification.token) });
        } catch {
            company.emailVerificationToken = undefined;
            company.emailVerificationExpires = undefined;
            await company.save().catch(() => {});
        }

        const companyData = company.toObject();
        delete companyData.hrPassword;
        delete companyData.emailVerificationToken;
        delete companyData.emailVerificationExpires;
        return res.status(201).json(companyData);
    }catch(error){
        if(error.code === 11000){
            return res.status(400).json({message: "HR email already exists"});
        }
        if(error.name === "ValidationError"){
            return res.status(400).json({message: "Invalid company data"});
        }
        console.error("Error registering company:", error);
        return res.status(500)
        .json(
            {
                message: "Internal server error"
            }
        )
    }
}


const loginCompany = async (req, res) => {
    try{
        const {companyName, hrEmail,hrPassword} = req.body ?? {};

        if(typeof companyName != "string" || !companyName.trim()){
            return res
                .status(400)
                .json({
                    message: "company name is required"
                })
        }
        if(typeof hrEmail != "string" || !hrEmail.trim()){
            return res
                .status(400)
                .json({
                    message: "HR Email is required"
                })
        }
        if(typeof hrPassword != "string" || !hrPassword.trim()){
            return res
                .status(400)
                .json({
                    message: "HR Password is required"
                })
        }

        if (!process.env.JWT_SECRET) {
            return res.status(500).json({ message: "Authentication is not configured" });
        }

        const company = await Company.findOne({hrEmail: hrEmail.trim().toLowerCase()});

        if(!company){
            return res
                .status(401)
                .json({ message: "Invalid email or password" });
        }
        if (company.isActive === false) return res.status(403).json({ message: "Company account is disabled" });
        if (company.companyName !== companyName.trim()) {
            return res
                .status(401)
                .json({ message: "Invalid Company Name" });
        }
        const isHashedPassword = /^\$2[ab]\$\d{2}\$/.test(company.hrPassword ?? "");
        const passwordMatches = isHashedPassword
            ? await bcrypt.compare(hrPassword.trim(), company.hrPassword)
            : company.hrPassword === hrPassword || company.hrPassword === hrPassword.trim();
        if (!passwordMatches) {
            return res
                .status(401)
                .json({ message: "Invalid password" });
        }

        if (requiresEmailVerification(company)) {
            return res.status(403).json({ message: "Please verify your email before logging in." });
        }

        const companyData = company.toObject();
        delete companyData.hrPassword;
        const token = jwt.sign(
            { companyId: company._id.toString(), email: company.hrEmail, role: "COMPANY" },
            process.env.JWT_SECRET,
            { expiresIn: "1h" },
        );
        return res.status(200).json({
            message: "Company logged in successfully",
            company: companyData,
            token,
        });

    } catch(err){
        console.error("Error logging in company:", err)
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function getCompanyDashboard(req, res) {
    const companyId = req.user?.companyId;
    try {
        const drives = await Drive.find({ company: companyId }).select("title status applicationDeadline driveDate createdAt").sort({ createdAt: -1 }).lean();
        const driveIds = drives.map(({ _id }) => _id);
        const [applicationCount, byStatus] = await Promise.all([
            Application.countDocuments({ drive: { $in: driveIds } }),
            Application.aggregate([{ $match: { drive: { $in: driveIds } } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
        ]);
        const stats = Object.fromEntries(byStatus.map(({ _id, count }) => [_id, count]));
        return res.status(200).json({ dashboard: { company: { name: req.company?.name || req.company?.companyName }, drives, stats: { drives: drives.length, published: drives.filter((drive) => drive.status === "Published").length, applications: applicationCount, shortlisted: stats.Shortlisted ?? 0, selected: stats.Selected ?? 0 }, applicationsByStatus: stats } });
    } catch (error) {
        console.error("Error retrieving company dashboard:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function getCompanyProfile(req, res) {
    try {
        const company = await Company.findById(req.user.companyId).select("name companyName description website location industry hrEmail hrName hrPhoneNumber hrContact logo profilePictureUrl isActive createdAt").lean();
        if (!company) return res.status(404).json({ message: "Company not found" });
        return res.status(200).json({ company });
    } catch (error) {
        console.error("Error retrieving company profile:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export async function updateCompanyProfile(req, res) {
    const allowed = ["hrName", "hrPhoneNumber", "description", "website"];
    const input = {};
    for (const field of allowed) if (Object.hasOwn(req.body ?? {}, field)) input[field] = req.body[field];
    if (!Object.keys(input).length) return res.status(400).json({ message: "At least one profile field is required" });
    for (const [field, value] of Object.entries(input)) {
        if (typeof value !== "string") return res.status(400).json({ message: `${field} must be a string` });
        input[field] = value.trim();
    }
    if (input.website && !validUrl.test(input.website)) return res.status(400).json({ message: "Website must be a valid URL" });
    try {
        const company = await Company.findByIdAndUpdate(req.user.companyId, { $set: input }, { returnDocument: "after", runValidators: true })
            .select("name companyName description website location industry hrEmail hrName hrPhoneNumber hrContact logo profilePictureUrl isActive").lean();
        if (!company) return res.status(404).json({ message: "Company not found" });
        return res.status(200).json({ message: "Profile updated successfully", company });
    } catch (error) {
        if (["ValidationError", "CastError"].includes(error.name)) return res.status(400).json({ message: "Invalid profile data" });
        console.error("Error updating company profile:", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}


const deleteCompany = async (req, res) => {
    try{
        const {companyId} = req.params ?? {};

        if(!companyId){
            return res
                .status(400)
                .json({
                    message: "Company ID is required"
                })  
        }

        const deletedCompany = await Company.findByIdAndDelete(companyId);
        if(!deletedCompany){
            return res
                .status(404)
                .json({
                    message: "Company not found"
                })
        }
        
        return res
            .status(200)
            .json({
                message: "Company deleted successfully"
            })
    } catch(err){
        res
            .status(500)
            .json({
                message: "Error deleting company",
                error: err.message
            })
        console.error("Error deleting company:", err)
    }
}


export {registerCompany, loginCompany, deleteCompany, createCompany, getCompanies, getCompanyById, updateCompany, removeCompany}
