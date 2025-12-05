// server.js
const express = require('express');
const path = require('path');
const {
  dbPath,
  createListing,
  getListingsByCategory
} = require('./db');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));

// Home
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle Sell form (writes to DB through db.js)
app.post('/sell', (req, res) => {
  const { name, location, price, description, imageUrl, category, condition } = req.body;

  if (!name || !location || !price || !description || !category || !condition) {
    return res.status(400).send('Missing required fields.');
  }

  createListing(
    { name, location, price, description, imageUrl, category, condition },
    (err, id) => {
      if (err) {
        console.error('Error inserting listing:', err);
        return res.status(500).send('Error saving your listing.');
      }

      // Redirect based on category
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

// API route (reads from DB through db.js)
app.get('/api/listings/:category', (req, res) => {
  const { category } = req.params;

  getListingsByCategory(category, (err, rows) => {
    if (err) {
      console.error('Error fetching listings:', err);
      return res.status(500).json({ error: 'Failed to load listings.' });
    }

    res.json(rows);
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Using SQLite database at: ${dbPath}`);
});
