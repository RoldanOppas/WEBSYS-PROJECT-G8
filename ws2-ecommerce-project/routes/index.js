const express = require('express');
const router = express.Router();

// Index route
router.get('/', (req, res) => {
  res.render('index', { 
    title: "Sweet Haven Bakery - Freshly Baked Daily"
  });
});

// About route
router.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Sweet Haven Bakery',
    name: 'Sweet Haven Bakery',
    description: 'We are a family-owned artisanal bakery dedicated to bringing you the finest baked goods. Established in 2010, our master bakers combine traditional techniques with premium ingredients to create unforgettable treats that bring joy to every celebration.'
  });
});

// Menu route
router.get('/menu', (req, res) => {
  res.render('menu', {
    title: 'Our Menu - Sweet Haven Bakery'
  });
});

// Contact route
router.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us - Sweet Haven Bakery'
  });
});

module.exports = router;