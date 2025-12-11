const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const { ObjectId } = require('mongodb');

// Admin: View All Orders
router.get('/', adminAuth, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const orders = await db.collection('orders')
            .find({})
            .sort({ createdAt: -1 })
            .toArray();

        res.render('admin-orders', {
            title: "Orders",
            orders
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Error loading orders");
    }
});

// Admin: Update Status
router.post('/update-status', adminAuth, async (req, res) => {
    try {
        const { orderId, status } = req.body;

        const db = req.app.locals.client.db(req.app.locals.dbName);
        await db.collection('orders').updateOne(
            { _id: new ObjectId(orderId) },
            { $set: { status } }
        );

        res.redirect('/admin/orders');
    } catch (err) {
        console.error(err);
        res.status(500).send("Failed to update status");
    }
});

module.exports = router;
