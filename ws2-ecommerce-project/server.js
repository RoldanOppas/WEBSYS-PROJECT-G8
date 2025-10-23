const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const session = require('express-session');
const path = require('path');
require('dotenv').config();

const app = express();

// Use process.env.PORT for Render, fallback to 3000 locally
const PORT = process.env.PORT || 3000;

// Trust proxy (important for Render deployment)
app.set('trust proxy', 1);

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
    secure: process.env.NODE_ENV === 'production', // true in production with HTTPS
    maxAge: 15 * 60 * 1000 // 15 minutes for testing
  }
}));

// Make user available to all views (must be before routes)
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  next();
});

// Session timeout middleware - ENHANCED
app.use((req, res, next) => {
  // Routes that don't require authentication
  const publicRoutes = [
    '/', 
    '/users/login', 
    '/users/register', 
    '/password/forgot',
    '/health', // health check endpoint
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

// Serve static files from public directory (before 404)
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.type('text').send('ok');
});

// Serve sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Log 404s for debugging (optional but helpful)
app.use((req, res, next) => {
  if (!res.headersSent) {
    console.warn('404:', req.method, req.originalUrl, 'Referrer:', req.get('referer') || '-');
  }
  next();
});

// 404 handler (must be after all routes and static files)
app.use((req, res, next) => {
  // Check if this is an API request
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Not Found', 
      path: req.path 
    });
  }
  
  // Prevent caching of 404 pages
  res.set('Cache-Control', 'no-store');
  res.status(404).render('404', { title: 'Page Not Found' });
});

// 500 Error handling middleware (must be last)
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Check if this is an API request
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
  }
  
  // Render 500 page for regular requests
  res.status(500).render('500', { 
    title: 'Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// Updated server startup with MongoDB connection
async function main() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");
    
    // Start server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
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