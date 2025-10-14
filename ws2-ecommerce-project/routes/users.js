// routes/users.js
const { v4: uuidv4 } = require('uuid');
const { Resend } = require('resend');
const verifyTurnstile = require('../utils/turnstileVerify');

const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const saltRounds = 12; // for bcrypt hashing

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Admin authorization middleware
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).send("Access denied. Admin privileges required.");
  }
  next();
}

// Show registration form
router.get('/register', (req, res) => {
  res.render('register', { title: "Register" });
});

// Handle registration - with Turnstile verification
router.post('/register', async (req, res) => {
  try {
    // Verify Turnstile token first
    const token = req.body['cf-turnstile-response'];
    if (!token) {
      return res.send("Verification failed. Please try again.");
    }

    const turnstileResult = await verifyTurnstile(token, req.ip);
    if (!turnstileResult.success) {
      return res.send("Verification failed. Please try again.");
    }

    const db = req.app.locals.client.db(req.app.locals.dbName);
    const usersCollection = db.collection('users');

    // 1. Validate required fields
    const { firstName, lastName, email, password } = req.body;
    if (!firstName || !lastName || !email || !password) {
      return res.send("All fields are required.");
    }

    // 2. Server-side password validation (double validation)
    const passwordRegex = {
      length: /.{8,}/,
      uppercase: /[A-Z]/,
      lowercase: /[a-z]/,
      number: /\d/,
      special: /[!@#$%^&*(),.?":{}|<>]/
    };

    const passwordErrors = [];
    if (!passwordRegex.length.test(password)) passwordErrors.push("at least 8 characters");
    if (!passwordRegex.uppercase.test(password)) passwordErrors.push("an uppercase letter");
    if (!passwordRegex.lowercase.test(password)) passwordErrors.push("a lowercase letter");
    if (!passwordRegex.number.test(password)) passwordErrors.push("a number");
    if (!passwordRegex.special.test(password)) passwordErrors.push("a special character");

    if (passwordErrors.length > 0) {
      return res.send(`Password must contain: ${passwordErrors.join(", ")}.`);
    }

    // 3. Check if user already exists
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });
    if (existingUser) return res.send("User already exists with this email.");

    // 4. Hash password
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const currentDate = new Date();

    // 5. Create verification token
    const verificationToken = uuidv4();

    // 6. Build new user object (schema matches requirements)
    const newUser = {
      userId: uuidv4(), // external user ID
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashedPassword,
      role: 'customer', // default role
      accountStatus: 'active', // default status
      isEmailVerified: false, // default false
      verificationToken: verificationToken,
      tokenExpiry: new Date(Date.now() + 3600000), // 1 hour expiry
      createdAt: currentDate,
      updatedAt: currentDate
    };

    // 7. Insert into database
    await usersCollection.insertOne(newUser);

    // 8. Build verification URL
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const verificationUrl = `${baseUrl}/users/verify/${verificationToken}`;

    // 9. Send verification email using Resend
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL,
      to: newUser.email,
      subject: 'Verify your account',
      html: `
        <h2>Welcome, ${newUser.firstName}!</h2>
        <p>Thank you for registering. Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Verify Email</a>
        <p>Or copy and paste this link: ${verificationUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't create this account, please ignore this email.</p>
      `
    });

    // 10. Show success message
    res.send(`
      <div style="max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; font-family: Inter, sans-serif;">
        <div style="background: #f0f9ff; border: 2px solid #3b82f6; border-radius: 8px; padding: 30px; margin: 20px 0;">
          <i class="fas fa-envelope-check" style="font-size: 48px; color: #3b82f6; margin-bottom: 16px;"></i>
          <h2 style="color: #1f2937; margin-bottom: 16px;">Registration Successful!</h2>
          <p style="color: #6b7280; margin-bottom: 20px;">A verification email has been sent to <strong>${newUser.email}</strong>.</p>
          <p style="color: #6b7280; margin-bottom: 20px;">Please check your inbox and click the verification link to activate your account.</p>
          <a href="/users/login" style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">Back to Login</a>
        </div>
      </div>
    `);

  } catch (err) {
    console.error("Error saving user:", err);
    res.send("Something went wrong during registration. Please try again.");
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
      <div style="max-width: 600px; margin: 50px auto; padding: 20px; text-align: center; font-family: Inter, sans-serif;">
        <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 8px; padding: 30px; margin: 20px 0;">
          <i class="fas fa-check-circle" style="font-size: 48px; color: #10b981; margin-bottom: 16px;"></i>
          <h2 style="color: #1f2937; margin-bottom: 16px;">Email Verified!</h2>
          <p style="color: #6b7280; margin-bottom: 20px;">Your account has been verified successfully.</p>
          <a href="/users/login" style="display: inline-block; padding: 12px 24px; background-color: #10b981; color: white; text-decoration: none; border-radius: 6px;">Proceed to Login</a>
        </div>
      </div>
    `);
  } catch (err) {
    console.error("Error verifying email:", err);
    res.send("Something went wrong during verification.");
  }
});

// Show login form
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

// Handle login - with Turnstile verification
router.post('/login', async (req, res) => {
  try {
    // Verify Turnstile token first
    const token = req.body['cf-turnstile-response'];
    if (!token) {
      return res.render('login', { 
        title: "Login", 
        message: "Verification failed. Please try again." 
      });
    }

    const turnstileResult = await verifyTurnstile(token, req.ip);
    if (!turnstileResult.success) {
      return res.render('login', { 
        title: "Login", 
        message: "Verification failed. Please try again." 
      });
    }

    const db = req.app.locals.client.db(req.app.locals.dbName);
    const usersCollection = db.collection('users');

    const { email, password } = req.body;
    
    // Basic field validation
    if (!email || !password) {
      return res.render('login', { 
        title: "Login", 
        message: "Email and password are required." 
      });
    }

    // Find user by email
    const user = await usersCollection.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.render('login', { 
        title: "Login", 
        message: "Invalid email or password." 
      });
    }

    // Check account status
    if (user.accountStatus !== 'active') {
      return res.render('login', { 
        title: "Login", 
        message: "Account is not active. Please contact support." 
      });
    }

    // Check email verification
    if (!user.isEmailVerified) {
      return res.render('login', { 
        title: "Login", 
        message: "Please verify your email before logging in. Check your inbox for the verification link." 
      });
    }

    // Validate password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.render('login', { 
        title: "Login", 
        message: "Invalid email or password." 
      });
    }

    // Create session (stores required data)
    req.session.user = {
      _id: user._id,
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    };

    req.session.lastActivity = Date.now(); // Set initial activity timestamp

    res.redirect('/users/dashboard');
  } catch (err) {
    console.error("Error during login:", err);
    res.render('login', { 
      title: "Login", 
      message: "Something went wrong. Please try again." 
    });
  }
});

// Dashboard route
router.get('/dashboard', (req, res) => {
  // This check is now handled by middleware, but keep for safety
  if (!req.session.user) return res.redirect('/users/login?expired=true');

  res.render('dashboard', {
    title: "User Dashboard",
    user: req.session.user
  });
});

// Admin view
router.get('/admin', requireAdmin, async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const users = await db.collection('users').find().toArray();
    
    res.render('admin', {
      title: "Admin Dashboard",
      users,
      currentUser: req.session.user
    });
  } catch (err) {
    console.error("Error loading admin page:", err);
    res.send("Something went wrong.");
  }
});

// Logout route
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
router.get('/list', requireAdmin, async (req, res, next) => {
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
router.get('/edit/:id', requireAdmin, async (req, res) => {
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
router.post('/edit/:id', requireAdmin, async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    
    const updateFields = {
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      email: req.body.email,
      updatedAt: new Date()
    };

    // Only allow role and status changes if provided
    if (req.body.role) {
      updateFields.role = req.body.role;
    }
    if (req.body.accountStatus) {
      updateFields.accountStatus = req.body.accountStatus;
    }

    await db.collection('users').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields }
    );

    res.redirect('/users/admin');
  } catch (err) {
    next(err);
  }
});

// Delete user
router.post('/delete/:id', requireAdmin, async (req, res, next) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    
    // Prevent admin from deleting themselves
    const userToDelete = await db.collection('users').findOne({ _id: new ObjectId(req.params.id) });
    if (userToDelete && userToDelete.userId === req.session.user.userId) {
      return res.send("You cannot delete your own account.");
    }
    
    await db.collection('users').deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect('/users/admin');
  } catch (err) {
    next(err);
  }
});

module.exports = router;