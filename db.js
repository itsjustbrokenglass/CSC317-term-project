// db.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'bikessf.db');
const db = new sqlite3.Database(dbPath);

// Create tables
db.serialize(() => {
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
});

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

module.exports = {
  db,
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
};





