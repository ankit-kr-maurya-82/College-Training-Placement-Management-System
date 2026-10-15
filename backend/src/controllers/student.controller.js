import { Student } from "../models/student.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes, createHash } from "node:crypto";

export function createStudentToken(student) {
    return jwt.sign(
        { studentId: student._id.toString(), email: student.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" },
    );
}

export function publicStudent(student) {
    return {
        _id: student._id,
        name: student.name,
        email: student.email,
    };
}



const registerStudent = async (req, res) => {

    try {
        const { name, email, password } = req.body ?? {};
        if (typeof name !== "string" || !name.trim()) {
            return res.status(400).json({ message: "Name is required" });
        }
        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({ message: "Email is required" });
        }
        if (typeof password !== "string" || !password.trim()) {
            return res.status(400).json({ message: "Password is required" });
        }



        // Check if the email already exists in the database
        const existingString = await Student.findOne({ email: email.trim().toLowerCase() });
        if (existingString) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Hash the password before saving it to the database
        const hashedPassword = await bcrypt.hash(password.trim(), 10);

        const newStudent = new Student({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password: hashedPassword,
        });

        // Generate a JWT token for the registered student
        const token = createStudentToken(newStudent);

        await newStudent.save();

        return res.status(201).json({
            message: "Student registered successfully",
            student: publicStudent(newStudent),
            token,
        });
        


    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "An account with this email already exists" });
        }
        console.error("Error registering student:", err);
        return res.status(500).json({
            message: "Error registering student",
        });
    }


}


const showStudents = async (req, res) => {
    try {
        const students = await Student.find().select("name email").sort({ createdAt: -1 }).lean();
        return res
            .render("students", { students, error: null });
    } catch (err) {
        console.error("Error loading students:", err);
        return res.status(500).render("students", {
            students: [],
            error: "Students could not be loaded. Please try again.",
        });
    }
};

const deleteStudent = async (req, res) => {
    try {
        const { id } = req.params ?? {};
        if (!id) {
            return res.status(400).json({ message: "Student ID is required" });
        }
        const student = await Student.findByIdAndDelete(id);
        if (!student) {
            return res
                .status(404)
                .json({ message: "Student not found" });
        }
        res
            .status(200)
            .json({ message: "Student deleted successfully" });
    } catch (err) {
        res
            .status(500)
            .json({
                message: "Error deleting student",
                error: err.message
            })
        console.error("Error deleting student:", err);
    }
}

const loginStudents = async (req, res) => {
    try {
        const { email, password } = req.body ?? {};

        if (typeof email !== "string" || !email.trim()) {
            return res
                .status(400)
                .json({ message: "Email is required" });
        }
        if (typeof password !== "string" || !password.trim()) {
            return res
                .status(400)
                .json({ message: "Password is required" });
        }

        const student = await Student.findOne({ email: email.trim().toLowerCase() }).select("+password");
        if (!student) {
            return res
                .status(401)
                .json({ message: "Invalid email or password" });
        }
        if (student.isActive === false) {
            return res.status(403).json({ message: "Student account is disabled" });
        }

        // Keep existing accounts usable while new registrations store bcrypt hashes.
        const isHashedPassword = /^\$2[ab]\$\d{2}\$/.test(student.password);
        const passwordMatches = isHashedPassword
            ? await bcrypt.compare(password.trim(), student.password)
            : student.password === password.trim();
        if (!passwordMatches) {
            return res
                .status(401)
                .json({ message: "Invalid password" });
        }

        const token = createStudentToken(student);

        return res.status(200).json({
            message: "Student logged in successfully",
            student: publicStudent(student),
            token,
        });
    } catch (err) {
        console.error("Error logging in student:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
}

export { registerStudent, showStudents, deleteStudent, loginStudents };
