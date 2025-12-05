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

// pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public'))); // CSS & images
app.use(express.urlencoded({ extended: true }));         // form POST

// ----- routes ----- //

// Home page
app.get('/', (req, res) => {
  res.render('index', {
    pageTitle: 'Bikes SF'
  });
});

// sell get
app.get('/sell.html', (req, res) => {
  res.render('sell', {
    pageTitle: 'Sell a Bike | Bikes SF'
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

      // Redirect based on category, keeping same URLs as before
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
    res.render('category', {
      pageTitle: 'Buy a Bike | Bikes SF',
      heading: 'Browse Bikes',
      subtitle: 'Explore used and new bikes available in the Bay Area.',
      listings
    });
  });
});

app.get('/helmets.html', (req, res) => {
  getListingsByCategory('helmets', (err, listings) => {
    if (err) return res.status(500).send('Error loading helmets.');
    res.render('category', {
      pageTitle: 'Helmets | Bikes SF',
      heading: 'Helmets',
      subtitle: 'Browse high-quality helmets for every ride.',
      listings
    });
  });
});

app.get('/accessories.html', (req, res) => {
  getListingsByCategory('accessories', (err, listings) => {
    if (err) return res.status(500).send('Error loading accessories.');
    res.render('category', {
      pageTitle: 'Accessories | Bikes SF',
      heading: 'Accessories',
      subtitle: 'Lights, locks, tools, and more.',
      listings
    });
  });
});

app.get('/parts.html', (req, res) => {
  getListingsByCategory('parts', (err, listings) => {
    if (err) return res.status(500).send('Error loading parts.');
    res.render('category', {
      pageTitle: 'Parts | Bikes SF',
      heading: 'Parts',
      subtitle: 'Replacement parts for repairs and upgrades.',
      listings
    });
  });
});

// server start
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Using SQLite database at: ${dbPath}`);
});
