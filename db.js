// db.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, 'bikessf.db');
const db = new sqlite3.Database(dbPath);


// table
db.serialize(() => {
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
});

// new listing
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

// listings by catagory
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


module.exports = {
  db,
  dbPath,
  createListing,
  getListingsByCategory,
  getListingById 
};






