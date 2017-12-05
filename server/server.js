const express = require('express');
const ProPublica = require('./services/ProPublica');
const PredictIt = require('./services/PredictIt');
const Ratings = require('./services/Ratings');
const StateNames = require('./data/states.json').names;
const config = require('./config.json')[process.env.NODE_ENV || "development"];
const db = require('./models.js');
const app = express();

// Load specific race details
app.get('/race/:race', (req, res) => {
   res.header('Access-Control-Allow-Origin', config.allowed_origin);
  const [state, district] = req.params.race.split('-');
  db.Race.find({
    where: {
      state: state.toUpperCase(),
      district: district ? parseInt(district) : 0
    },
    include: ['candidates']
  }).then(race => {
    if(!race){
      res.status(404);
      return res.send('Race not found');
    }

    return res.json({
      state_name: StateNames[race.state],
      ...race.dataValues
    });
  });
});

// Load all races
app.get('/races', (req, res) => {
  res.header('Access-Control-Allow-Origin', config.allowed_origin);
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

const port = process.env.PORT || config.port || 3000;
app.listen(port, () => console.log(`Server listening on port ${port}...`))
