import express, { json } from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import { fileURLToPath } from "node:url"

const app = express()
app.set("view engine", "ejs")
app.set("views", fileURLToPath(new URL("./views/", import.meta.url)))
app.get("/", (req, res) => res.redirect("/api/v1/students/register"))

const allowedOrigins = (process.env.CORS_ORIGIN
    ?? (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173"))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        callback(null, !origin || allowedOrigins.includes(origin));
    },
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(cookieParser())


// import routes
import companyRouter from "./routes/comapany.routes.js"
import studentRouter from "./routes/student.routes.js"
import driveRouter from "./routes/drive.routes.js"
import applicationRouter from "./routes/application.routes.js"
import adminRouter from "./routes/admin.routes.js"
import authRouter from "./routes/auth.routes.js"

// routes

const baseUrl = "/api/v1"


app.use(`${baseUrl}/students`, studentRouter);
app.use(`${baseUrl}/companies`, companyRouter);
app.use(`${baseUrl}/drives`, driveRouter);
app.use(`${baseUrl}/applications`, applicationRouter);
app.use(`${baseUrl}/admin`, adminRouter);
app.use(`${baseUrl}/auth`, authRouter);
//
export {app}
