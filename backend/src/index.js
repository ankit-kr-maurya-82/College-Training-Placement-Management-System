import dotenv from "dotenv"

import { app } from "./app.js";
import connectDB from './db/index.js';
import { startDriveNotificationWorker } from "./services/drive-notification-worker.js";
import { provisionTpoFromEnvironment } from "./services/tpo-bootstrap.service.js";

dotenv.config({
    path: './.env'
})

connectDB()
.then(async()=> {
    await provisionTpoFromEnvironment();
    startDriveNotificationWorker().catch((error) => {
        console.error("Vacancy notification worker could not start:", error?.name || "database initialization failed");
    });
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
        console.log(`Server is running at port : ${port}`);
        
    })
})
.catch((err)=>{
    console.error("Backend startup failed:", err.message);
    process.exitCode = 1;
})
