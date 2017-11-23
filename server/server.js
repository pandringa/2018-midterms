const express = require('express');

const ProPublica = require('./ProPublica');
const config = require('./config.json')[process.env.NODE_ENV || "development"];
const db = require('./models.js');
const app = express();

// If DB is empty
  // Load data from ProPublica



// For Request:
  // Read Data from DB
  // If data > 1 day old, queue new data
app.get('/', (req, res) => {
  db.loadAll()
    .then((results) => {
      res.send('Done!');
    });
});

// CRON JOB - Load Data from ProPublica once a week

const port = process.env.PORT || config.port || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}...`))
