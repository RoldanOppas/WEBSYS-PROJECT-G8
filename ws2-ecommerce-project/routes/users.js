// routes/users.js
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const saltRounds = 12; // for bcrypt hashing

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Show registration form
router.get('/register', (req, res) => {
  res.render('register', { title: "Register" });
});

// Handle registration
router.post('/register', async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const usersCollection = db.collection('users');

    // 1. Check if user already exists
    const existingUser = await usersCollection.findOne({ email: req.body.email });
    if (existingUser) return res.send("User already exists with this email.");

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(req.body.password, saltRounds);
    const currentDate = new Date();

    // 3. Create verification token
    const token = uuidv4();

    // 4. Build new user object
    const newUser = {
      userId: uuidv4(), // external user ID
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      passwordHash: hashedPassword,
      role: 'customer',
      accountStatus: 'active',
      isEmailVerified: false,
      verificationToken: token,
      tokenExpiry: new Date(Date.now() + 3600000), // 1 hour expiry
      createdAt: currentDate,
      updatedAt: currentDate
    };

    // 5. Insert into database
    await usersCollection.insertOne(newUser);

    // 6. Build verification URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/users/verify/${token}`;

    // 7. Send verification email using Resend
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: newUser.email,
      subject: 'Verify your account',
      html: `
        <h2>Welcome, ${newUser.firstName}!</h2>
        <p>Thank you for registering. Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">${verificationUrl}</a>
        <p>This link will expire in 1 hour.</p>
      `
    });

    // 8. Show success message (no verification link displayed)
    res.send(`
      <h2>Registration Successful!</h2>
      <p>A verification email has been sent to <strong>${newUser.email}</strong>.</p>
      <p>Please check your inbox and click the verification link to activate your account.</p>
      <p><a href="/users/login">Back to Login</a></p>
    `);

  } catch (err) {
    console.error("Error saving user:", err);
    res.send("Something went wrong.");
  }
});

// Email verification route
router.get('/verify/:token', async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ verificationToken: req.params.token });

    if (!user) return res.send("Invalid or expired verification link.");
    if (user.tokenExpiry < new Date()) return res.send("Verification link has expired. Please register again.");

    // Mark as verified
    await usersCollection.updateOne(
      { _id: user._id },
      { 
        $set: { isEmailVerified: true, updatedAt: new Date() },
        $unset: { verificationToken: "", tokenExpiry: "" }
      }
    );

    res.send(`
      <h2>Email Verified!</h2>
      <p>Your account has been verified successfully.</p>
      <a href="/users/login">Proceed to Login</a>
    `);
  } catch (err) {
    console.error("Error verifying email:", err);
    res.send("Something went wrong during verification.");
  }
});

// Show login form - UPDATED
router.get('/login', (req, res) => {
  let message = null;
  
  // Check for logout message
  if (req.query.logout === 'true') {
    message = "You have been logged out.";
  }
  
  // Check for session expired message
  if (req.query.expired === 'true') {
    message = "Your session has expired. Please log in again.";
  }
  
  res.render('login', { 
    title: "Login",
    message: message
  });
});

// Handle login
router.post('/login', async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ email: req.body.email });
    if (!user) return res.send("User not found.");

    if (user.accountStatus !== 'active') {
      return res.send("Account is not active.");
    }

    // Block login if not verified
    if (!user.isEmailVerified) {
      return res.send("Please verify your email before logging in.");
    }

    const isPasswordValid = await bcrypt.compare(req.body.password, user.passwordHash);
    if (!isPasswordValid) return res.send("Invalid password.");

    // Save session
    req.session.user = {
      _id: user._id,
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    };

    res.redirect('/users/dashboard');
  } catch (err) {
    console.error("Error during login:", err);
    res.send("Something went wrong.");
  }
});

// Dashboard route - UPDATED
router.get('/dashboard', (req, res) => {
  // This check is now handled by middleware, but keep for safety
  if (!req.session.user) return res.redirect('/users/login?expired=true');

  res.render('dashboard', {
    title: "User Dashboard",
    user: req.session.user
  });
});

// Logout route - UPDATED
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      return res.send("Something went wrong during logout.");
    }
    res.redirect('/users/login?logout=true');
  });
});

// User list
router.get('/list', async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const users = await db.collection('users')
      .find({}, { projection: { passwordHash: 0 } })
      .toArray();

    res.render('user-list', { title: "User List", users });
  } catch (err) {
    next(err);
  }
});

// Edit user (GET)
router.get('/edit/:id', async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const user = await db.collection('users')
      .findOne({ _id: new ObjectId(req.params.id) });
    if (!user) return res.send("User not found.");

    res.render('edit-user', { title: "Edit User", user }); 
  } catch (err) {
    console.error("Error loading user:", err);
    res.send("Something went wrong.");
  }
});

// Edit user (POST update)
router.post('/edit/:id', async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      {
        $set: {
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          email: req.body.email,
          updatedAt: new Date()
        }
      }
    );

    res.redirect('/users/list');
  } catch (err) {
    next(err);
  }
});

// Delete user
router.post('/delete/:id', async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });

    res.redirect('/users/list');
  } catch (err) {
    next(err);
  }
});

module.exports = router;