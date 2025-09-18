const express = require('express');
const router = express.Router();

// Index route
router.get('/', (req, res) => {
  res.render('index', { 
    title: "HelloStore - Your One-Stop Shop"
  });
});

module.exports = router;