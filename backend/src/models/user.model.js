import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, lowercase: true, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["ADMIN", "TPO"], required: true, uppercase: true, trim: true },
}, { timestamps: true });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;
