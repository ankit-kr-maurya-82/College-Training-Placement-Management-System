import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function provisionTpoFromEnvironment() {
    const email = process.env.TPO_EMAIL?.trim().toLowerCase();
    const password = process.env.TPO_PASSWORD;

    if (!email && !password) return;
    if (!email || !password) {
        throw new Error("Both TPO_EMAIL and TPO_PASSWORD must be configured together");
    }
    if (!emailPattern.test(email)) throw new Error("TPO_EMAIL must be a valid email address");
    if (password.trim().length < 8) throw new Error("TPO_PASSWORD must be at least 8 characters");

    const existingUser = await User.findOne({ email });
    if (existingUser) {
        if (existingUser.role !== "TPO") {
            throw new Error("TPO_EMAIL is already assigned to a non-TPO account");
        }
        return;
    }

    await User.create({
        name: "Placement TPO",
        email,
        password: await bcrypt.hash(password, 10),
        role: "TPO",
    });
    console.info(`Initial TPO account provisioned for ${email}`);
}
