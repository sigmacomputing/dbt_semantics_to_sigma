const express = require('express');
const cors = require('cors');
const app = express();

const routes = require('./routes');

// Use CORS with the specified options
app.use(cors({ origin: false }));

// Middleware to parse JSON bodies
app.use(express.json());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Use routes defined in routes.js
app.use('/', routes);

// Start the server
const PORT = process.env.PORT || 85;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});