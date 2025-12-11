const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');

// Middleware to check if user is admin
function isAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/users/login');
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).render('403', { 
      title: 'Access Denied',
      message: 'You do not have permission to access this page.' 
    });
  }
  next();
}

// GET /admin/products - List all products
router.get('/admin/products', isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const products = await db.collection('products').find().toArray();
    
    res.render('admin-products', {
      title: 'Product Management',
      products: products,
      currentUser: req.session.user
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).render('500', { 
      title: 'Server Error',
      message: 'Failed to load products' 
    });
  }
});

// GET /admin/products/new - Show add product form
router.get('/admin/products/new', isAdmin, (req, res) => {
  res.render('admin-product-form', {
    title: 'Add New Product',
    product: null,
    currentUser: req.session.user
  });
});

// POST /admin/products - Create new product
router.post('/admin/products', isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    
    const newProduct = {
      name: req.body.name,
      category: req.body.category,
      description: req.body.description,
      price: parseFloat(req.body.price),
      originalPrice: parseFloat(req.body.originalPrice),
      stock: parseInt(req.body.stock),
      image: req.body.image || '🍰',
      rating: parseFloat(req.body.rating) || 5.0,
      badge: req.body.badge || null,
      featured: req.body.featured === 'on',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('products').insertOne(newProduct);
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).render('500', { 
      title: 'Server Error',
      message: 'Failed to create product' 
    });
  }
});

// GET /admin/products/edit/:id - Show edit product form
router.get('/admin/products/edit/:id', isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    const product = await db.collection('products').findOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    if (!product) {
      return res.status(404).render('404', { title: 'Product Not Found' });
    }
    
    res.render('admin-product-form', {
      title: 'Edit Product',
      product: product,
      currentUser: req.session.user
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).render('500', { 
      title: 'Server Error',
      message: 'Failed to load product' 
    });
  }
});

// POST /admin/products/edit/:id - Update product
router.post('/admin/products/edit/:id', isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    
    const updatedProduct = {
      name: req.body.name,
      category: req.body.category,
      description: req.body.description,
      price: parseFloat(req.body.price),
      originalPrice: parseFloat(req.body.originalPrice),
      stock: parseInt(req.body.stock),
      image: req.body.image,
      rating: parseFloat(req.body.rating),
      badge: req.body.badge || null,
      featured: req.body.featured === 'on',
      updatedAt: new Date()
    };
    
    await db.collection('products').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updatedProduct }
    );
    
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).render('500', { 
      title: 'Server Error',
      message: 'Failed to update product' 
    });
  }
});

// POST /admin/products/delete/:id - Delete product
router.post('/admin/products/delete/:id', isAdmin, async (req, res) => {
  try {
    const db = req.app.locals.client.db(req.app.locals.dbName);
    
    await db.collection('products').deleteOne({ 
      _id: new ObjectId(req.params.id) 
    });
    
    res.redirect('/admin/products');
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).render('500', { 
      title: 'Server Error',
      message: 'Failed to delete product' 
    });
  }
});

module.exports = router;