import mongoose from "mongoose";

const studentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            required: true,
        },
        // rollNumber: {
        //     type: String,
        //     // required: true,
        //     unique: true,
        //     trim: true,
        //     uppercase: true,
        // },
        // department: {
        //     type: String,
        //     // required: true,
        //     trim: true,
        // },
        // course: {
        //     type: String,
        //     // required: true,
        //     trim: true,
        // },
        // graduationYear: {
        //     type: Number,
        //     // required: true,
        //     min: 1900,
        //     validate: {
        //         validator: Number.isInteger,
        //         message: "Graduation year must be a whole number",
        //     },
        // },
        // cgpa: {
        //     type: Number,
        //     min: 0,
        //     max: 10,
        // },
        // tenthPercentage: {
        //     type: Number,
        //     min: 0,
        //     max: 100,
        // },
        // twelfthPercentage: {
        //     type: Number,
        //     min: 0,
        //     max: 100,
        // },
        // activeBacklogs: {
        //     type: Number,
        //     min: 0,
        //     validate: {
        //         validator: Number.isInteger,
        //         message: "Active backlogs must be a whole number",
        //     },
        // },
        // skills: [{ type: String, trim: true }],
        // resumeUrl: {
        //     type: String,
        //     trim: true,
        // },
    },
    { timestamps: true },
);

export const Student = mongoose.model("Student", studentSchema);

export default Student;
