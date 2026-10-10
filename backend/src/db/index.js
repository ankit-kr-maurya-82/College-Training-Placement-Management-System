import mongoose from "mongoose";
import { AdminDB } from "../constants.js";

const connectDB = async() => {
    try {
        const connectionInstance = await mongoose.connect(`${process.env.MONGODB_URI}/${AdminDB}`)
        console.log(`\n MongoDB connected !! DB HOST: ${connectionInstance.connection.host,AdminDB}`);
        
    } catch (error) {
        console.log(`MONGODB connection error ${error}`);
        process.exit(1)
        
    }
}


export default connectDB
