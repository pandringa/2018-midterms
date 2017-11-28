const express = require('express');

const ProPublica = require('./services/ProPublica');
const PredictIt = require('./services/PredictIt');
const Ratings = require('./services/Ratings');
const config = require('./config.json')[process.env.NODE_ENV || "development"];
const db = require('./models.js');
const app = express();

// For Request:
  // Read Data from DB
  // If data > 1 day old, queue new data
app.get('/finance/:state', (req, res) => {
  res.send('To be implemented');
});
app.get('/tweets/:state', (req, res) => {
  res.send('To be implemented');
});
app.get('/markets/:state', (req, res) => {
  if(req.params.state == 'all'){
    PredictIt.getSenate()
      .then( data => res.send(data) );
  }else{
    res.send(req.params.state);
  }
});
app.get('/predictions/:predictor', (req, res) => {
  
});
app.get('/races/:state/:district', (req, res) => {
  res.send('To be implemented');
});

// If DB is empty
  // Load data from ProPublica
app.get('/', (req, res) => {
  Promise.all(
    Object.keys(require('./data/states.json').names)
      .map(state => db.loadState(state))
  ).then(result => {
    console.log('FINISHED FIRST');
    return result;
  });
});

// CRON JOB - Load Data from ProPublica once a week

const port = process.env.PORT || config.port || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}...`))
