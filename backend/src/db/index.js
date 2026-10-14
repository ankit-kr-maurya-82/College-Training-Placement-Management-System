import mongoose from "mongoose";
import { AdminDB } from "../constants.js";

const connectDB = async() => {
    try {
        const mongoUri = process.env.MONGODB_URI;
        if (!mongoUri) throw new Error("MONGODB_URI is not configured");
        const connectionInstance = await mongoose.connect(mongoUri, { dbName: AdminDB });
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host,AdminDB}`);
        
    } catch (error) {
        console.log(`MONGODB connection error ${error}`);
        process.exit(1)
        
    }
}


export default connectDB
