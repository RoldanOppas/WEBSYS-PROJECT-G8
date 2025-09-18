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

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Session setup - UPDATED with timeout
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret', // keep secret in .env
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // set true in production with HTTPS
    maxAge: 15 * 60 * 1000 // 15 minutes for testing
  }
}));

// Session timeout middleware - ENHANCED
app.use((req, res, next) => {
  // Routes that don't require authentication
  const publicRoutes = [
    '/', 
    '/users/login', 
    '/users/register', 
    '/password/forgot',
    '/styles/', // Allow static files
    '/scripts/',
    '/images/'
  ];
  
  const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route)) || 
                       req.path.startsWith('/password/reset/') ||
                       req.path.startsWith('/users/verify/');
  
  if (!isPublicRoute) {
    // Check if user session exists
    if (!req.session.user) {
      return res.redirect('/users/login?expired=true');
    }
    
    // Check for session timeout (15 minutes of inactivity)
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const timeoutDuration = 15 * 60 * 1000; // 15 minutes
    
    if (now - lastActivity > timeoutDuration) {
      // Session expired due to inactivity
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
      });
      return res.redirect('/users/login?expired=true');
    }
    
    // Update session activity timestamp
    req.session.lastActivity = now;
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).send('Something went wrong!');
});

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
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await client.close();
  process.exit(0);
});

main();