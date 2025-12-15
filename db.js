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
      sellerId INTEGER,
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
      shippingAddress TEXT,
      city TEXT,
      state TEXT,
      zipCode TEXT,
      phone TEXT,
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

function createListing(data, callback) {
  const { name, location, price, description, imageUrl, category, condition, sellerId } = data;

  const finalImageUrl =
    imageUrl && imageUrl.trim() !== '' ? imageUrl.trim() : 'brown-road-bike-free-png.png';

  const sql = `
    INSERT INTO listings (name, location, price, description, imageUrl, category, condition, sellerId)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.run(
    sql,
    [name, location, price, description, finalImageUrl, category, condition, sellerId || null],
    function (err) {
      if (err) return callback(err);
      callback(null, this.lastID);
    }
  );
}

function getListingsByCategory(category, callback) {
  const sql = `
    SELECT id, name, location, price, description, imageUrl, category, condition, createdAt
    FROM listings
    WHERE category = ?
    ORDER BY createdAt DESC
  `;

  db.all(sql, [category], callback);
}

function getListingById(id, callback) {
  const sql = `
    SELECT id, name, location, price, description, imageUrl, category, condition, createdAt
    FROM listings
    WHERE id = ?
  `;
  
  db.get(sql, [id], callback);
}

// ===== CART FUNCTIONS =====

function addToCart(userId, listingId, callback) {
  const checkSql = `SELECT id, quantity FROM cart WHERE userId = ? AND listingId = ?`;
  
  db.get(checkSql, [userId, listingId], (err, row) => {
    if (err) return callback(err);
    
    if (row) {
      const updateSql = `UPDATE cart SET quantity = quantity + 1 WHERE id = ?`;
      db.run(updateSql, [row.id], callback);
    } else {
      const insertSql = `INSERT INTO cart (userId, listingId, quantity) VALUES (?, ?, 1)`;
      db.run(insertSql, [userId, listingId], callback);
    }
  });
}

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

function updateCartQuantity(userId, listingId, quantity, callback) {
  const sql = `
    UPDATE cart 
    SET quantity = ? 
    WHERE userId = ? AND listingId = ?
  `;
  
  db.run(sql, [quantity, userId, listingId], callback);
}

function removeFromCart(userId, listingId, callback) {
  const sql = `DELETE FROM cart WHERE userId = ? AND listingId = ?`;
  db.run(sql, [userId, listingId], callback);
}

function clearCart(userId, callback) {
  const sql = `DELETE FROM cart WHERE userId = ?`;
  db.run(sql, [userId], callback);
}

function getCartCount(userId, callback) {
  const sql = `SELECT COUNT(DISTINCT listingId) as count FROM cart WHERE userId = ?`;
  db.get(sql, [userId], (err, row) => {
    if (err) return callback(err);
    callback(null, row ? row.count : 0);
  });
}

function assignListingToSeller(listingId, sellerId, callback) {
  if (!sellerId) return callback && callback(null);
  const sql = `
    INSERT OR REPLACE INTO listing_sellers (listingId, sellerId)
    VALUES (?, ?)
  `;
  db.run(sql, [listingId, sellerId], callback);
}

// ===== ORDER FUNCTIONS =====

function createOrderFromCart(userId, cartUserId, shippingInfo, callback) {
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

    const { shippingAddress, city, state, zipCode, phone } = shippingInfo;

    db.run(
      `INSERT INTO orders (userId, total, shippingAddress, city, state, zipCode, phone) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, total, shippingAddress, city, state, zipCode, phone],
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

          db.run(`DELETE FROM cart WHERE userId = ?`, [cartUserId], err3 => {
            if (err3) return callback(err3);
            callback(null, orderId);
          });
        });
      }
    );
  });
}

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

function getUserSellingHistory(userId, callback) {
  const sql = `
    SELECT 
      id,
      name,
      price,
      imageUrl,
      category,
      condition,
      location,
      createdAt
    FROM listings
    WHERE sellerId = ?
    ORDER BY createdAt DESC
  `;
  db.all(sql, [userId], callback);
}

module.exports = {
  db,
  dbPath,
  createUser,
  getUserByEmail,     
  getUserById,
  createListing,
  getListingsByCategory,
  getListingById,
  addToCart,
  getCartItems,
  updateCartQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
  createOrderFromCart,
  getUserPurchaseHistory,
  getUserSellingHistory
};








