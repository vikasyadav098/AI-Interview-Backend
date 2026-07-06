require('dotenv').config()
const cors=require('cors')
const { config } = require('dotenv')
const express =require("express")
const connectDb=require('./src/config/db')
const router = require('./src/routes/interviewRoutes')

connectDb()

const app = express()
const port = process.env.PORT || 5001
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://ai-interview-gilt-six.vercel.app'
]

app.use(express.json())

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

app.use('/api/interview', router)

app.listen(port, () => {
    console.log(`port is successfully running ${port}`)
})

