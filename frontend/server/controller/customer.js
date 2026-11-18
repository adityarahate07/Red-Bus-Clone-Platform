const Customer = require('../models/customer');

exports.addnewcustomer = async (req, res) => {
    try {
        const { name, email, googleId, profilepicture } = req.body;
        // console.log(name,email,googleId,profilepicture)
        let exisitingcustomer = await Customer.findOne({ email: email }).lean().exec();
        if (exisitingcustomer) {
            res.send(exisitingcustomer)
        } else {
            const customer = new Customer({
                name, email, googleId, profilepicture
            });
            const newCustomer = await customer.save()
            res.status(201).json(newCustomer);
        }
    } catch (error) {
        console.error('error adding customer', error);
        res.status(500).json({ error: "internal server error" });
    }
}

exports.updatePreferences = async (req, res) => {
    try {
        const { id } = req.params;
        const { preferredTheme, preferredLanguage } = req.body;
        const updates = {};
        if (preferredTheme === 'light' || preferredTheme === 'dark') {
            updates.preferredTheme = preferredTheme;
        }
        if (preferredLanguage === 'en' || preferredLanguage === 'hi' || preferredLanguage === 'mr') {
            updates.preferredLanguage = preferredLanguage;
        }
        const updated = await Customer.findByIdAndUpdate(
            id,
            { $set: updates },
            { new: true }
        ).lean().exec();
        if (!updated) {
            return res.status(404).json({ error: "customer not found" });
        }
        res.json(updated);
    } catch (error) {
        console.error('error updating preferences', error);
        res.status(500).json({ error: "internal server error" });
    }
}