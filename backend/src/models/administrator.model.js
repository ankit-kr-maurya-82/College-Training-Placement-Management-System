import mongoose, {Schema} from "mongoose"

const studentSchema = new Schema(
    {
        studentName: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            index:true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index:true,
        },
        firstName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        lastName: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        bio:{
            type: String,
            trim: true,
            default: ""
        },
        avatar: {
            type: String
        },
        password:{
            type: String,
            required: [true, "Password is required"]
        },
        role:{
            type: String,
            default: "user"
        },
        dob:{
            type: Date
        }
    },
    {
        timestamps:true
    })