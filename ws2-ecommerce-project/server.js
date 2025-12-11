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
app.use(express.json()); // ADD THIS - Required for JSON body parsing in checkout route
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static files FIRST (before session middleware)
app.use(express.static(path.join(__dirname, 'public')));

// Session setup - UPDATED with timeout
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 15 * 60 * 1000 // 15 minutes
  }
}));

// Make user available to all views
app.use((req, res, next) => {
  res.locals.user = req.session?.user || null;
  next();
});

// MongoDB Setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Expose client & dbName to routes
app.locals.client = client;
app.locals.dbName = process.env.DB_NAME || "ecommerceDB";

// Health check endpoint
app.get('/health', (req, res) => {
  res.type('text').send('ok');
});

// Serve sitemap.xml
app.get('/sitemap.xml', (req, res) => {
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});

// Session timeout middleware - UPDATED WITH PUBLIC ROUTES
app.use((req, res, next) => {
  const publicRoutes = [
    '/', 
    '/about',
    '/menu',
    '/contact',
    '/users/login',
    '/users/register',
    '/password/forgot',
    '/health',
    '/sitemap.xml'
  ];

  const staticFileExtensions = [
    '.css', '.js', '.png', '.jpg', '.jpeg', 
    '.gif', '.ico', '.svg', '.woff', '.woff2', 
    '.ttf', '.eot'
  ];

  const isStaticFile = staticFileExtensions.some(ext => req.path.endsWith(ext));

  const isPublicRoute =
    publicRoutes.includes(req.path) ||
    req.path.startsWith('/password/reset/') ||
    req.path.startsWith('/users/verify/') ||
    isStaticFile;

  if (!isPublicRoute) {
    // No session?
    if (!req.session.user) {
      return res.redirect('/users/login?expired=true');
    }

    // Session timeout
    const now = Date.now();
    const lastActivity = req.session.lastActivity || now;
    const timeoutDuration = 15 * 60 * 1000;

    if (now - lastActivity > timeoutDuration) {
      req.session.destroy((err) => {
        if (err) console.error("Session destruction error:", err);
      });
      return res.redirect('/users/login?expired=true');
    }

    req.session.lastActivity = now;
  }

  next();
});

// ROUTES (MOUNT AFTER SESSION MIDDLEWARE)
const indexRoute = require('./routes/index');
const usersRoute = require('./routes/users');
const passwordRoute = require('./routes/password');
const productsRoute = require('./routes/products');
const ordersRoute = require('./routes/orders'); // ADD THIS
const adminOrdersRoute = require('./routes/adminOrders'); // ADD THIS

app.use('/', indexRoute);
app.use('/users', usersRoute);
app.use('/password', passwordRoute);
app.use('/', productsRoute);
app.use('/orders', ordersRoute); // ADD THIS
app.use('/admin', adminOrdersRoute); // ADD THIS

// Log 404s
app.use((req, res, next) => {
  if (!res.headersSent) {
    console.warn('404:', req.method, req.originalUrl, 'Referrer:', req.get('referer') || '-');
  }
  next();
});

// 404 handler
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error: 'Not Found', 
      path: req.path 
    });
  }

  res.set('Cache-Control', 'no-store');
  res.status(404).render('404', { title: 'Page Not Found' });
});

// 500 handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ 
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : err.message
    });
  }

  res.status(500).render('500', { 
    title: 'Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message
  });
});

// Server + MongoDB start
async function main() {
  try {
    await client.connect();
    console.log("Connected to MongoDB Atlas");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error("MongoDB connection failed", err);
    process.exit(1);
  }
}

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await client.close();
  process.exit(0);
});

main();