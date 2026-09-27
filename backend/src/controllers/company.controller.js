import {Company} from '../models/company.model.js';

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

        const company = await Company.create({
            companyName: companyName.trim(),
            hrName: hrName.trim(),
            hrEmail: normalizedEmail,
            hrPassword,
            hrPhoneNumber: hrPhoneNumber.trim(),
            location: location.trim(),
            website: website.trim(),
            description: description.trim()
        });

        const companyData = company.toObject();
        delete companyData.hrPassword;
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

export {registerCompany}
