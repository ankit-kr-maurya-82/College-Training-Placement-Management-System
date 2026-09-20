import { Student } from "../models/student.model.js";

const registerStudent = async (req, res) => {

    try{
        const {name, email, password} = req.body ?? {};
        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({message: "Name is required"});
        }
        if(typeof email !== "string" || !email.trim()) {
            return res.status(400).json({message: "Email is required"});
        }
        if(typeof password !== "string" || !password.trim()) {
            return res.status(400).json({message: "Password is required"});
        }
        


        // Check if the email already exists in the database
        const existingString = await Student.findOne({email: email.trim().toLowerCase()});
        if(existingString){
            return res.status(400).json({message: "Email already exists"});
        }
        
        const student = await Student.create({name: name.trim(), email: email.trim().toLowerCase(), password: password.trim()});
        res.status(201).json(student);


    }catch(err){
        res.status(500).json({
            message: "Error registering student",
            error: err.message
        })
        console.error("Error registering student:", err);
    }


}


const showStudents = async (req, res) => {
    try {
        const students = await Student.find().select("name email").sort({createdAt: -1}).lean();
        return res.render("students", {students, error: null});
    } catch (err) {
        console.error("Error loading students:", err);
        return res.status(500).render("students", {
            students: [],
            error: "Students could not be loaded. Please try again.",
        });
    }
};

export { registerStudent, showStudents };
