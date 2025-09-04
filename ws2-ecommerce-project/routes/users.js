// routes/users.js
const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');  // ✅ Import bcrypt
require('dotenv').config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbName = "ecommerceDB";

// Show registration form
router.get('/register', (req, res) => {
  res.render('register', { title: "Register" });
});

// Handle registration (already updated in Part 4)
router.post('/register', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    const existingUser = await usersCollection.findOne({ email: req.body.email });
    if (existingUser) return res.send("User already exists with this email.");

    const hashedPassword = await bcrypt.hash(req.body.password, 12);
    const currentDate = new Date();

    const newUser = {
      userId: new ObjectId(), // or uuid if you prefer
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      passwordHash: hashedPassword,
      role: 'customer',
      accountStatus: 'active',
      isEmailVerified: false,
      createdAt: currentDate,
      updatedAt: currentDate
    };

    await usersCollection.insertOne(newUser);

    res.send(`
      <h2>Registration Successful!</h2>
      <p>User ${newUser.firstName} ${newUser.lastName} registered with ID: ${newUser.userId}</p>
      <a href="/users/login">Proceed to Login</a>
    `);
  } catch (err) {
    console.error("Error registering user:", err);
    res.send("Something went wrong.");
  }
});

// ✅ Show login form
router.get('/login', (req, res) => {
  res.render('login', { title: "Login" });
});

// ✅ Handle login form
router.post('/login', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: req.body.email });
    if (!user) return res.send("User not found.");

    if (user.accountStatus !== 'active') {
      return res.send("Account is not active.");
    }

    const isPasswordValid = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!isPasswordValid) return res.send("Invalid password.");

    // ✅ Save session
    req.session.user = {
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    };

    res.redirect('/users/dashboard');
  } catch (err) {
    console.error("Error during login:", err);
    res.send("Something went wrong.");
  }
});

// Dashboard route
router.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/users/login');

  res.render('dashboard', {
    title: "User Dashboard",
    user: req.session.user
  });
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/users/login');
  });
});

// Admin view
router.get('/admin', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send("Access denied.");
  }

  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const users = await db.collection('users').find().toArray();

    res.render('admin', {
      title: "Admin Dashboard",
      users,
      currentUser: req.session.user
    });
  } catch (err) {
    console.error("Error loading admin dashboard:", err);
    res.send("Something went wrong.");
  }
});


module.exports = router;
