const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Serve everything inside the public folder
app.use(express.static(path.join(__dirname, 'public')));

// Route for homepage — serves index.html automatically
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
