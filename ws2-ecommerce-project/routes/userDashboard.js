const express = require("express");
const router = express.Router();
const requireLogin = require("../middleware/requireLogin");

// GET /user/dashboard – user overview and order counts
router.get("/dashboard", requireLogin, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const ordersCollection = db.collection("orders");
        const user = req.session.user;

        const userOrders = await ordersCollection
            .find({ userId: user.userId })
            .sort({ createdAt: -1 })
            .toArray();

        const statusCounts = {
            to_pay: 0,
            to_ship: 0,
            to_receive: 0,
            completed: 0,
            refund: 0,
            cancelled: 0
        };

        userOrders.forEach(order => {
            const status = order.orderStatus;
            if (statusCounts[status] !== undefined) {
                statusCounts[status]++;
            }
        });

        const totalOrders = userOrders.length;

        res.render("user-dashboard", {
            title: "User Dashboard",
            user,
            statusCounts,
            totalOrders
        });
    } catch (err) {
        console.error("Error loading user dashboard:", err);
        res.status(500).send("Error loading dashboard.");
    }
});

// GET /user/profile – view profile
router.get("/profile", requireLogin, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const usersCollection = db.collection("users");

        const userFromSession = req.session.user;

        const user = await usersCollection.findOne({
            userId: userFromSession.userId
        });

        const updated = req.query.updated === "1";

        res.render("user-profile", {
            title: "User Profile",
            user,
            updated
        });
    } catch (err) {
        console.error("Error loading user profile:", err);
        res.status(500).send("Error loading profile.");
    }
});

// POST /user/profile – update profile
router.post("/profile", requireLogin, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const usersCollection = db.collection("users");

        const userFromSession = req.session.user;

        const address = (req.body.address || "").trim();
        const contactNumber = (req.body.contactNumber || "").trim();

        await usersCollection.updateOne(
            { userId: userFromSession.userId },
            { $set: { address, contactNumber } }
        );

        req.session.user.address = address;
        req.session.user.contactNumber = contactNumber;

        res.redirect("/user/profile?updated=1");
    } catch (err) {
        console.error("Error updating user profile:", err);
        res.status(500).send("Error updating profile.");
    }
});

// GET /user/orders – purchase history
router.get("/orders", requireLogin, async (req, res) => {
    try {
        const db = req.app.locals.client.db(req.app.locals.dbName);
        const ordersCollection = db.collection("orders");
        const userFromSession = req.session.user;

        const userOrders = await ordersCollection
            .find({ userId: userFromSession.userId })
            .sort({ createdAt: -1 })
            .toArray();

        const ordersByStatus = {
            to_pay: [],
            to_ship: [],
            to_receive: [],
            completed: [],
            refund: [],
            cancelled: []
        };

        userOrders.forEach(order => {
            const status = order.orderStatus;
            if (ordersByStatus[status]) {
                ordersByStatus[status].push(order);
            }
        });

        res.render("user-orders", {
            title: "My Orders",
            user: userFromSession,
            ordersByStatus
        });
    } catch (err) {
        console.error("Error loading user orders:", err);
        res.status(500).send("Error loading orders.");
    }
});

module.exports = router;
