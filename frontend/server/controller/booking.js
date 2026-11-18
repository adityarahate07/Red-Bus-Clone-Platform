const Booking=require("../models/booking");

exports.addbooking=async(req,res)=>{
    const booking =await Booking.create(req.body);
    console.log(booking);
    res.send(booking);
}

exports.getBooking =async(req,res)=>{
    let {id}=req.params;
    const booking=await Booking.find().lean().exec();
    let filteredBookings=booking.filter((booking)=>booking.customerId.toString()== id);
    res.send(filteredBookings)
}

exports.updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!['upcoming', 'completed', 'cancelled'].includes(status)) {
            return res.status(400).json({ error: 'Invalid booking status' });
        }
        const updated = await Booking.findByIdAndUpdate(
            id,
            { $set: { status } },
            { new: true }
        ).lean().exec();
        if (!updated) {
            return res.status(404).json({ error: 'Booking not found' });
        }
        res.json(updated);
    } catch (error) {
        console.error('Error updating booking status:', error);
        res.status(500).json({ error: 'Failed to update booking status' });
    }
}