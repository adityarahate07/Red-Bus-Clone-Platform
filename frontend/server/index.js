const express=require('express')
const bodyparser=require('body-parser')
const cors =require('cors')
const mongoose=require('mongoose')
require('dotenv').config()

const app=express();

app.use(cors());
app.use(bodyparser.json({ limit: '5mb' }))
const customerroutes=require("./routes/customer");
const routesroute=require("./routes/route");
const bookingroute=require("./routes/booking");
const reviewroute=require("./routes/review");
const communityroute=require("./routes/community");
const notificationroute=require("./routes/notification");
const savedrouteroute=require("./routes/saved-route");
app.use(bookingroute)
app.use(routesroute)
app.use(customerroutes)
app.use(reviewroute)
app.use(communityroute)
app.use(notificationroute)
app.use(savedrouteroute)

const DBURL = process.env.MONGODB_URI
if (DBURL) {
    mongoose.connect(DBURL)
        .then(() => console.log("Mongodb connected"))
        .catch(err => console.error('Mongodb connection error:', err))
} else {
    console.warn('MONGODB_URI is not set; database-backed API features are unavailable.')
}

app.get('/',(req,res)=>{
    res.send('Hello , Ted bus is working')
})

const PORT= 5000
app.listen(PORT,()=>{
    console.log(`server is running on port ${PORT}`)
})
