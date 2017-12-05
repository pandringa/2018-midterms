const express = require('express');

const ProPublica = require('./services/ProPublica');
const PredictIt = require('./services/PredictIt');
const Ratings = require('./services/Ratings');
const StateNames = require('./data/states.json').names;
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

app

// Load all races
app.get('/races', (req, res) => {
  res.header('Access-Control-Allow-Origin', '*');
  db.Race.findAll({
    include: [{
      model: db.Candidate,
      where: { 
        status: "I"        
      }
    }]
  })
  .then(data =>{
    const races = data.map( d => {
      return {
        state_name: StateNames[d.state],
        ...d.dataValues
      }
    });

    return res.send({
      senate: races.filter(r => r.district == 0),
      house: races.filter(r => r.district > 0)
    })
  });
});

// CRON JOB - Load Data from ProPublica once a week

const port = process.env.PORT || config.port || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}...`))
