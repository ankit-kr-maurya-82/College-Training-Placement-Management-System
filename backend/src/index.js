import dotenv from 'dotenv'
import express from "express"
const app = express()
const port = process.env.PORT || 4000

app.get('/',(req,res) => {
    res.send("Hello WOlrd");
})

app.listen(port, () => {
    console.log(`Serve at http://localhost:${port}`)
})