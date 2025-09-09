const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Use process.env.PORT for Render, fallback to 3000 locally
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Session setup - UPDATED with timeout
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret', // keep secret in .env
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // set true in production with HTTPS
    maxAge: 1 * 60 * 1000 // 1 minute for testing
  }
}));

// Session timeout middleware - ADD THIS
app.use((req, res, next) => {
  // Routes that don't require authentication
  const publicRoutes = ['/', '/users/login', '/users/register', '/password/forgot'];
  const isPublicRoute = publicRoutes.includes(req.path) || 
                       req.path.startsWith('/password/reset/') ||
                       req.path.startsWith('/users/verify/');
  
  if (!isPublicRoute) {
    // Check if user session exists
    if (!req.session.user) {
      return res.redirect('/users/login?expired=true');
    }
    
    // Update session activity timestamp
    req.session.lastActivity = Date.now();
  }
  
  next();
});

// MongoDB Setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Expose client & dbName to routes
app.locals.client = client;
app.locals.dbName = process.env.DB_NAME || "ecommerceDB";

// Routes
const indexRoute = require('./routes/index');
const usersRoute = require('./routes/users');
const passwordRoute = require('./routes/password');

app.use('/', indexRoute);
app.use('/users', usersRoute);
app.use('/password', passwordRoute);

// Updated server startup with MongoDB connection
async function main() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed", err);
  }
}

main();