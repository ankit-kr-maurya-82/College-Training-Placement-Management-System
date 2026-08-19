import mongoose, {Schema} from "mongoose"

const userSchema = new Schema(
    {
        username: {
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
            enum:['student', 'admin', 'recruiter'],
            default: "user"
        },
        phone:{
            type: Number,
            required: true
        },
        address:{
            type: String,
            required: true
        },
        gender:{
            type:String,
            enum:["male","female", "other"]
        }
    },
    {
        timestamps:true
    })


export const User = mongoose.model("User")