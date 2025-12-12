const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'bikessf.db');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Listings table
  db.run(`
    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT NOT NULL,
      price REAL NOT NULL,
      description TEXT NOT NULL,
      imageUrl TEXT,
      category TEXT NOT NULL,
      condition TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Cart table
  db.run(`
    CREATE TABLE IF NOT EXISTS cart (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      listingId INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (listingId) REFERENCES listings(id),
      UNIQUE(userId, listingId)
    )
  `);

    // Orders table (completed checkouts)
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      total REAL NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (userId) REFERENCES users(id)
    )
  `);

  // Individual items inside an order
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId INTEGER NOT NULL,
      listingId INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      priceAtPurchase REAL NOT NULL,
      FOREIGN KEY (orderId) REFERENCES orders(id),
      FOREIGN KEY (listingId) REFERENCES listings(id)
    )
  `);

  // Mapping between listings and the user who sold/posted them
  db.run(`
    CREATE TABLE IF NOT EXISTS listing_sellers (
      listingId INTEGER PRIMARY KEY,
      sellerId INTEGER NOT NULL,
      FOREIGN KEY (listingId) REFERENCES listings(id),
      FOREIGN KEY (sellerId) REFERENCES users(id)
    )
  `);

});

// ===== USER FUNCTIONS =====

function createUser({ name, email, passwordHash }, callback) {
  const sql = `
    INSERT INTO users (name, email, passwordHash)
    VALUES (?, ?, ?)
  `;
  db.run(sql, [name, email, passwordHash], function (err) {
    if (err) return callback(err);
    callback(null, this.lastID);
  });
}

function getUserByEmail(email, callback) {
  const sql = `SELECT * FROM users WHERE email = ?`;
  db.get(sql, [email], callback);
}

function getUserById(id, callback) {
  const sql = `SELECT * FROM users WHERE id = ?`;
  db.get(sql, [id], callback);
}

// ===== LISTING FUNCTIONS =====

// Create new listing
function createListing(data, callback) {
  const { name, location, price, description, imageUrl, category, condition } = data;

  const finalImageUrl =
    imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : 'brown-road-bike-free-png.png';

  const sql = `
    INSERT INTO listings (name, location, price, description, imageUrl, category, condition)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [name, location, price, description, finalImageUrl, category, condition],
    function (err) {
      if (err) return callback(err);
      callback(null, this.lastID);
    }
  );
}

// Get listings by category
function getListingsByCategory(category, callback) {
  const sql = `
    SELECT id, name, location, price, description, imageUrl, category, condition, createdAt
    FROM listings
    WHERE category = ?
    ORDER BY createdAt DESC
  `;

  db.all(sql, [category], callback);
}

// Get single listing by ID
function getListingById(id, callback) {
  const sql = `
    SELECT id, name, location, price, description, imageUrl, category, condition, createdAt
    FROM listings
    WHERE id = ?
  `;
  
  db.get(sql, [id], callback);
}

// ===== CART FUNCTIONS =====

// Add item to cart (or increment quantity if exists)
function addToCart(userId, listingId, callback) {
  // First check if item already in cart
  const checkSql = `SELECT id, quantity FROM cart WHERE userId = ? AND listingId = ?`;
  
  db.get(checkSql, [userId, listingId], (err, row) => {
    if (err) return callback(err);
    
    if (row) {
      // Item exists, increment quantity
      const updateSql = `UPDATE cart SET quantity = quantity + 1 WHERE id = ?`;
      db.run(updateSql, [row.id], callback);
    } else {
      // New item, insert
      const insertSql = `INSERT INTO cart (userId, listingId, quantity) VALUES (?, ?, 1)`;
      db.run(insertSql, [userId, listingId], callback);
    }
  });
}

// Get all cart items for a user with listing details
function getCartItems(userId, callback) {
  const sql = `
    SELECT 
      cart.id as cartId,
      cart.quantity,
      listings.id,
      listings.name,
      listings.price,
      listings.imageUrl,
      listings.condition,
      listings.location
    FROM cart
    JOIN listings ON cart.listingId = listings.id
    WHERE cart.userId = ?
    ORDER BY cart.addedAt DESC
  `;
  
  db.all(sql, [userId], callback);
}

// Update cart item quantity
function updateCartQuantity(userId, listingId, quantity, callback) {
  const sql = `
    UPDATE cart 
    SET quantity = ? 
    WHERE userId = ? AND listingId = ?
  `;
  
  db.run(sql, [quantity, userId, listingId], callback);
}

// Remove item from cart
function removeFromCart(userId, listingId, callback) {
  const sql = `DELETE FROM cart WHERE userId = ? AND listingId = ?`;
  db.run(sql, [userId, listingId], callback);
}

// Clear entire cart for user
function clearCart(userId, callback) {
  const sql = `DELETE FROM cart WHERE userId = ?`;
  db.run(sql, [userId], callback);
}

// Get cart item count for user
function getCartCount(userId, callback) {
  const sql = `SELECT COUNT(DISTINCT listingId) as count FROM cart WHERE userId = ?`;
  db.get(sql, [userId], (err, row) => {
    if (err) return callback(err);
    callback(null, row ? row.count : 0);
  });
}

// Link a listing to the seller (user)
function assignListingToSeller(listingId, sellerId, callback) {
  if (!sellerId) return callback && callback(null); // allow anonymous listings
  const sql = `
    INSERT OR REPLACE INTO listing_sellers (listingId, sellerId)
    VALUES (?, ?)
  `;
  db.run(sql, [listingId, sellerId], callback);
}

// Turn cart items into an order
function createOrderFromCart(userId, cartUserId, callback) {
  const getCartSql = `
    SELECT c.listingId, c.quantity, l.price
    FROM cart c
    JOIN listings l ON c.listingId = l.id
    WHERE c.userId = ?
  `;

  db.all(getCartSql, [cartUserId], (err, items) => {
    if (err) return callback(err);
    if (!items || items.length === 0) {
      return callback(new Error('Cart is empty'));
    }

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    db.run(
      `INSERT INTO orders (userId, total) VALUES (?, ?)`,
      [userId, total],
      function (err) {
        if (err) return callback(err);
        const orderId = this.lastID;

        const stmt = db.prepare(`
          INSERT INTO order_items (orderId, listingId, quantity, priceAtPurchase)
          VALUES (?, ?, ?, ?)
        `);

        for (const item of items) {
          stmt.run(orderId, item.listingId, item.quantity, item.price);
        }

        stmt.finalize(err2 => {
          if (err2) return callback(err2);

          // Clear cart after successful order
          db.run(`DELETE FROM cart WHERE userId = ?`, [cartUserId], err3 => {
            if (err3) return callback(err3);
            callback(null, orderId);
          });
        });
      }
    );
  });
}

// Get "what I bought" for a user
function getUserPurchaseHistory(userId, callback) {
  const sql = `
    SELECT 
      o.id as orderId,
      o.createdAt,
      o.total,
      oi.quantity,
      oi.priceAtPurchase,
      l.id as listingId,
      l.name,
      l.imageUrl
    FROM orders o
    JOIN order_items oi ON o.id = oi.orderId
    JOIN listings l ON oi.listingId = l.id
    WHERE o.userId = ?
    ORDER BY o.createdAt DESC, oi.id ASC
  `;
  db.all(sql, [userId], callback);
}

// Get "what I sold/listed" for a user
function getUserSellingHistory(userId, callback) {
  const sql = `
    SELECT 
      l.id,
      l.name,
      l.price,
      l.imageUrl,
      l.createdAt
    FROM listing_sellers ls
    JOIN listings l ON ls.listingId = l.id
    WHERE ls.sellerId = ?
    ORDER BY l.createdAt DESC
  `;
  db.all(sql, [userId], callback);
}


module.exports = {
  db,
  dbPath,
  // user helpers (if you have them)
  createUser,
  getUserByEmail,
  getUserById,
  // listings
  createListing,
  getListingsByCategory,
  getListingById,
  // cart
  addToCart,
  getCartItems,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
  // new profile-related helpers
  assignListingToSeller,
  createOrderFromCart,
  getUserPurchaseHistory,
  getUserSellingHistory
};







