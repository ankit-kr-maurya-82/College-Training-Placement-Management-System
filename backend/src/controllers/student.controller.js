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
        
        const student = await Student.create({
            name: name.trim(), 
            email: email.trim().toLowerCase(), 
            password: password.trim()
        });
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
        const students = await Student.find().select("name email password").sort({createdAt: -1}).lean();
        return res.render("students", {students, error: null});
    } catch (err) {
        console.error("Error loading students:", err);
        return res.status(500).render("students", {
            students: [],
            error: "Students could not be loaded. Please try again.",
        });
    }
};

const deleteStudent = async (req, res) => {
    try{
        const {id} = req.params ?? {};
        if(!id){
            return res.status(400).json({message: "Student ID is required"});
        }
        const student = await Student.findByIdAndDelete(id);
        if(!student){
            return res.status(404).json({message: "Student not found"});
        }
        res.status(200).json({message: "Student deleted successfully"});
    }catch(err){
        res.status(500).json({
            message: "Error deleting student",
            error: err.message
        })
        console.error("Error deleting student:", err);
    }
}

const loginStudents = async (req, res) => {
    try {
        const {email, password} = req.body ?? {};

        if(typeof email !== "string" || !email.trim()) {
            return res.status(400).json({message: "Email is required"});
        }
        if(typeof password !== "string" || !password.trim()) {
            return res.status(400).json({message: "Password is required"});
        }

        const student = await Student.findOne({email: email.trim().toLowerCase()});
        if(!student) {
            return res.status(401).json({message: "Invalid email or password"});
        }

        if(student.password !== password.trim()) {
            return res.status(401).json({message: "Invalid email or password"});
        }

        return res.status(200).json({
            message: "Student logged in successfully",
            student: {
                _id: student._id,
                name: student.name,
                email: student.email,
            },
        });
    } catch(err) {
        res.status(500).json({
            message: "Error logging in student",
            error: err.message
        })
        console.error("Error logging in student:", err);
    }
}

export { registerStudent, showStudents, deleteStudent, loginStudents };
