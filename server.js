require('dotenv').config()
const cors=require('cors')
const { config } = require('dotenv')
const express =require("express")
const connectDb=require('./src/config/db')
const router = require('./src/routes/interviewRoutes')

connectDb()

const app = express()

app.use(express.json())

app.use(cors({
  origin: 'http://localhost:5173','https://ai-interview-gilt-six.vercel.app/',
}));

app.use('/api/interview',router,)

app.listen(5001,()=>{
    console.log("port is successfully running 5001")
})

