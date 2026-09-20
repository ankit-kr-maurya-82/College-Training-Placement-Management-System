import { Student } from "../models/student.model.js";

const registerStudent = async (req, res) => {

    try{
        const {name} = req.body ?? {};
        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({message: "Name is required"});
        }
        
        const student = await Student.create({name: name.trim()});
        res.status(201).json(student);

    }catch(err){
        res.status(500).json({
            message: "Error registering student",
            error: err.message
        })
        console.error("Error registering student:", err);
    }


}


export { registerStudent };
