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
    maxAge: 15 * 60 * 1000 // 15 minutes (in milliseconds)
  }
}));

// MongoDB Setup
const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);

// Expose client & dbName to routes
app.locals.client = client;
app.locals.dbName = process.env.DB_NAME || "ecommerceDB";

// Routes
const indexRoute = require('./routes/index');
const usersRoute = require('./routes/users');

app.use('/', indexRoute);
app.use('/users', usersRoute);

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