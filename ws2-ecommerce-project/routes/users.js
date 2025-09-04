// routes/users.js
const express = require('express');
const router = express.Router();
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const uri = process.env.MONGO_URI;
const client = new MongoClient(uri);
const dbName = "ecommerceDB";

// Show registration form
router.get('/register', (req, res) => {
  res.render('register', { title: "Register" });
});

// Handle registration
router.post('/register', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    await usersCollection.insertOne({
      name: req.body.name,
      email: req.body.email
    });

    res.redirect('/users/list');
  } catch (err) {
    console.error("Error registering user:", err);
    res.send("Something went wrong.");
  }
});

// List users
router.get('/list', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    const users = await usersCollection.find().toArray();
    res.render('users-list', { title: "Users List", users });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.send("Something went wrong.");
  }
});

// Edit user form
router.get('/edit/:id', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    const user = await usersCollection.findOne({ _id: new ObjectId(req.params.id) });
    res.render('edit-user', { title: "Edit User", user });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.send("Something went wrong.");
  }
});

// Handle edit
router.post('/edit/:id', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    await usersCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { name: req.body.name, email: req.body.email } }
    );

    res.redirect('/users/list');
  } catch (err) {
    console.error("Error updating user:", err);
    res.send("Something went wrong.");
  }
});

// ✅ Delete user
router.post('/delete/:id', async (req, res) => {
  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCollection = db.collection('users');

    await usersCollection.deleteOne({ _id: new ObjectId(req.params.id) });
    res.redirect('/users/list');
  } catch (err) {
    console.error("Error deleting user:", err);
    res.send("Something went wrong.");
  }
});

module.exports = router;
