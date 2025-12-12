// server.js
const express = require('express');
const path = require('path');
const session = require('express-session');
const {
  dbPath,
  createListing,
  getListingsByCategory,
  getListingById,
  addToCart,
  getCartItems,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount
} = require('./db');

const app = express();
const PORT = 3000;

// Session middleware for user identification
app.use(session({
  secret: 'bikes-sf-secret-key-change-in-production',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true with HTTPS
}));

// pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // For AJAX requests

// Initialize session ID if needed
app.use((req, res, next) => {
  if (!req.session.userId) {
    req.session.userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
  next();
});

// ----- routes ----- //

// Home page
app.get('/', (req, res) => {
  getCartCount(req.session.userId, (err, count) => {
    res.render('index', {
      pageTitle: 'Bikes SF',
      cartCount: count || 0
    });
  });
});

app.get('/profile', (req, res) => {
  getCartCount(req.session.userId, (err, count) => {
    res.render('profile', {
      pageTitle: 'Log in/Sign Up | Bikes SF',
      cartCount: count || 0
    });
  });
});

// sell get
app.get('/sell.html', (req, res) => {
  getCartCount(req.session.userId, (err, count) => {
    res.render('sell', {
      pageTitle: 'Sell a Bike | Bikes SF',
      cartCount: count || 0
    });
  });
});

// sell post
app.post('/sell', (req, res) => {
  const { name, location, price, description, imageUrl, category, condition } = req.body;

  if (!name || !location || !price || !description || !category || !condition) {
    return res.status(400).send('Missing required fields.');
  }

  createListing(
    { name, location, price, description, imageUrl, category, condition },
    (err) => {
      if (err) {
        console.error('Error inserting listing:', err);
        return res.status(500).send('Error saving your listing.');
      }

      switch (category) {
        case 'bikes':
          return res.redirect('/buy.html');
        case 'helmets':
          return res.redirect('/helmets.html');
        case 'accessories':
          return res.redirect('/accessories.html');
        case 'parts':
          return res.redirect('/parts.html');
        default:
          return res.redirect('/buy.html');
      }
    }
  );
});

// Category pages rendered with Pug, pulling from DB
app.get('/buy.html', (req, res) => {
  getListingsByCategory('bikes', (err, listings) => {
    if (err) return res.status(500).send('Error loading bikes.');
    getCartCount(req.session.userId, (err, count) => {
      res.render('category', {
        pageTitle: 'Buy a Bike | Bikes SF',
        heading: 'Browse Bikes',
        subtitle: 'Explore used and new bikes available in the Bay Area.',
        listings,
        cartCount: count || 0
      });
    });
  });
});

app.get('/helmets.html', (req, res) => {
  getListingsByCategory('helmets', (err, listings) => {
    if (err) return res.status(500).send('Error loading helmets.');
    getCartCount(req.session.userId, (err, count) => {
      res.render('category', {
        pageTitle: 'Helmets | Bikes SF',
        heading: 'Helmets',
        subtitle: 'Browse high-quality helmets for every ride.',
        listings,
        cartCount: count || 0
      });
    });
  });
});

app.get('/accessories.html', (req, res) => {
  getListingsByCategory('accessories', (err, listings) => {
    if (err) return res.status(500).send('Error loading accessories.');
    getCartCount(req.session.userId, (err, count) => {
      res.render('category', {
        pageTitle: 'Accessories | Bikes SF',
        heading: 'Accessories',
        subtitle: 'Lights, locks, tools, and more.',
        listings,
        cartCount: count || 0
      });
    });
  });
});

app.get('/parts.html', (req, res) => {
  getListingsByCategory('parts', (err, listings) => {
    if (err) return res.status(500).send('Error loading parts.');
    getCartCount(req.session.userId, (err, count) => {
      res.render('category', {
        pageTitle: 'Parts | Bikes SF',
        heading: 'Parts',
        subtitle: 'Replacement parts for repairs and upgrades.',
        listings,
        cartCount: count || 0
      });
    });
  });
});

// Product detail page
app.get('/product/:id', (req, res) => {
  const productId = req.params.id;
  
  getListingById(productId, (err, listing) => {
    if (err) {
      console.error('Error loading product:', err);
      return res.status(500).send('Error loading product.');
    }
    
    if (!listing) {
      return res.status(404).send('Product not found.');
    }
    
    getCartCount(req.session.userId, (err, count) => {
      res.render('product', {
        pageTitle: `${listing.name} | Bikes SF`,
        listing,
        cartCount: count || 0
      });
    });
  });
});

// Cart routes
app.post('/cart/add', (req, res) => {
  const { productId } = req.body;
  const userId = req.session.userId;
  
  console.log('Adding to cart - userId:', userId, 'productId:', productId);
  
  // First verify the product exists
  getListingById(productId, (err, listing) => {
    if (err) {
      console.error('Error finding product:', err);
      return res.status(500).json({ success: false, message: 'Error finding product' });
    }
    
    if (!listing) {
      console.error('Product not found:', productId);
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    
    // Product exists, now add to cart
    addToCart(userId, productId, (err) => {
      if (err) {
        console.error('Error adding to cart:', err);
        return res.status(500).json({ success: false, message: 'Failed to add to cart: ' + err.message });
      }
      
      console.log('Successfully added to cart');
      
      getCartCount(userId, (err, count) => {
        if (err) {
          console.error('Error getting cart count:', err);
          return res.json({ 
            success: true, 
            cartCount: 0,
            message: 'Item added to cart'
          });
        }
        
        res.json({ 
          success: true, 
          cartCount: count || 0,
          message: 'Item added to cart'
        });
      });
    });
  });
});

app.get('/cart', (req, res) => {
  const userId = req.session.userId;
  
  getCartItems(userId, (err, cartItems) => {
    if (err) {
      console.error('Error loading cart:', err);
      return res.status(500).send('Error loading cart.');
    }
    
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    res.render('cart', {
      pageTitle: 'Shopping Cart | Bikes SF',
      cartItems,
      total,
      cartCount: cartItems.length
    });
  });
});

app.post('/cart/update', (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.session.userId;
  
  if (quantity <= 0) {
    removeFromCart(userId, productId, (err) => {
      if (err) return res.status(500).json({ success: false });
      getCartCount(userId, (err, count) => {
        res.json({ success: true, cartCount: count || 0 });
      });
    });
  } else {
    updateCartQuantity(userId, productId, quantity, (err) => {
      if (err) return res.status(500).json({ success: false });
      getCartCount(userId, (err, count) => {
        res.json({ success: true, cartCount: count || 0 });
      });
    });
  }
});

app.post('/cart/remove', (req, res) => {
  const { productId } = req.body;
  const userId = req.session.userId;
  
  removeFromCart(userId, productId, (err) => {
    if (err) return res.status(500).json({ success: false });
    getCartCount(userId, (err, count) => {
      res.json({ success: true, cartCount: count || 0 });
    });
  });
});

app.post('/cart/clear', (req, res) => {
  const userId = req.session.userId;
  
  clearCart(userId, (err) => {
    if (err) return res.status(500).json({ success: false });
    res.json({ success: true });
  });
});

// server start
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Using SQLite database at: ${dbPath}`);
});