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
    await startDriveNotificationWorker();
    const port = process.env.PORT || 5000;
    app.listen(port, () => {
        console.log(`Server is running at port : ${port} (process ${process.pid})`);
        
    })
})
.catch((err)=>{
    console.error("Backend startup failed:", JSON.stringify({
        processId: process.pid,
        errorName: err?.name || "Error",
        queueState: "STARTUP_FAILED",
    }));
    process.exitCode = 1;
})
