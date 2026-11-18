import dotenv from "dotenv"

import { app } from "./app.js";
import connectDB from './db/index.js';
import { startDriveNotificationWorker } from "./services/drive-notification-worker.js";
import { startResumeExtractionWorker, stopResumeExtractionWorker } from "./services/resume-extraction-worker.js";
import { provisionTpoFromEnvironment } from "./services/tpo-bootstrap.service.js";

dotenv.config({
    path: './.env'
})

connectDB()
.then(async()=> {
    await provisionTpoFromEnvironment();
    await startDriveNotificationWorker();
    startResumeExtractionWorker();
    const port = process.env.PORT || 5000;
    const server = app.listen(port, () => {
        console.log(`Server is running at port : ${port} (process ${process.pid})`);
    });
    const shutdown = () => { stopResumeExtractionWorker(); server.close(() => process.exit(0)); };
    process.on("SIGTERM", shutdown);
    process.on("SIGINT", shutdown);
})
.catch((err)=>{
    console.error("Backend startup failed:", JSON.stringify({
        processId: process.pid,
        errorName: err?.name || "Error",
        queueState: "STARTUP_FAILED",
    }));
    process.exitCode = 1;
})
