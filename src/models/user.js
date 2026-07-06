const mongoose =require("mongoose")

const userSchema=new mongoose.schema({
    name:{
    type:String,
        unique:true
    },
   
    email:{
    type:String,
        unique:true
    },
   
    password:{
    type:String,
        unique:true
    },
   
    role:{
    type:String,
        unique:true
    },
   
    createdAt:{
    type:Date,
        unique:true
    },
   
})
const userModel = mongoose.model("user",userSchema)

module.exports=userModel