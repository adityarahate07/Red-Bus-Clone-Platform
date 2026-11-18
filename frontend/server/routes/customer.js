const express=require("express")
const router=express.Router();
const customercontroller=require("../controller/customer")

router.post("/customer",customercontroller.addnewcustomer)
router.patch("/customer/:id/preferences",customercontroller.updatePreferences)

module.exports=router;