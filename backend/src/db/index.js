import mongoose from "mongoose";
import { AdminDB } from "../constants.js";
import dns from "dns"

dns.setServers([
    '8.8.8.8',
  '8.8.4.4',
  '1.1.1.1',
  '0.0.0.0'
])



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