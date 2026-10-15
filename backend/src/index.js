import dotenv from "dotenv"

import { app } from "./app.js";
import connectDB from './db/index.js';

dotenv.config({
    path: './.env'
})

connectDB()
.then(()=> {
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
        console.log(`Server is running at port : ${port}`);
        
    })
})
.catch((err)=>{
    console.log(`Mongo DB connection failed !!! ${err}`);
    
})
