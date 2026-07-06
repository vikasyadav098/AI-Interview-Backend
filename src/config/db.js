const mongoose =require('mongoose')

async function connectDb(){

    try{
            await mongoose.connect(process.env.MONGO_URI)
    console.log("Database connected successfully")

    }catch(err){
        console.log("Datbase connection error",err)
    }

}
module.exports=connectDb