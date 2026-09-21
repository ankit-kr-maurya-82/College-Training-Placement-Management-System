import express, { json } from "express"
import cors from "cors"
import cookieParser from "cookie-parser"
import studentRouter from "./routes/student.routes.js"
import { fileURLToPath } from "node:url"

const app = express()
app.set("view engine", "ejs")
app.set("views", fileURLToPath(new URL("./views/", import.meta.url)))
app.get("/", (req, res) => res.redirect("/api/v1/students/register"))

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
app.use(cookieParser())

// routes


app.use("/api/v1/students", studentRouter);
app.use("/api/v1/students",studentRouter);

export {app}
