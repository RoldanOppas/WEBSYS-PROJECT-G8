const express = require('express');
const router = express.Router();
const requireLogin = require('../middleware/requireLogin');
const Order = require('../models/Order');
const { ObjectId } = require('mongodb');

// Checkout – save order
router.post('/checkout', requireLogin, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);

        const { cart } = req.body;

        if (!cart || cart.length === 0) {
            return res.status(400).send("Cart is empty");
        }

        // Convert the cart items
        const items = cart.map(item => ({
            productId: new ObjectId(item.productId),
            name: item.name,
            price: Number(item.price),
            quantity: Number(item.quantity)
        }));

        const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

        const order = new Order({
            userId: new ObjectId(req.session.user._id),
            items,
            total,
            status: "Pending"
        });

        const result = await db.collection('orders').insertOne(order);

        res.redirect('/orders/success');
    } catch (err) {
        console.error(err);
        res.status(500).send("Checkout failed");
    }
});

// Checkout success page
router.get('/success', requireLogin, (req, res) => {
    res.render('order-success', { title: "Order Successful" });
});

module.exports = router;
