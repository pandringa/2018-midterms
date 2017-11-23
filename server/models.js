"use strict";
const Sequelize = require("sequelize");
const got = require('got');
const ProPublica = require('./ProPublica.js');
const config = require('./config.json')[process.env.NODE_ENV || "development"];
const db = {
  sequelize: new Sequelize(config.db_uri)
};

db.Update = db.sequelize.define('updates', {
  success: Sequelize.BOOLEAN,
  error: Sequelize.TEXT
}, {
  underscored: true
});

db.Race = db.sequelize.define('race', {
  state: Sequelize.STRING,
  district: Sequelize.INTEGER, // 0 if senate, district # if house
  total_contrib: Sequelize.INTEGER,
  total_disbursements: Sequelize.INTEGER
}, {
  underscored: true
});

db.Candidate = db.sequelize.define('candidate', {
  fec_id: Sequelize.STRING,
  first_name: Sequelize.STRING,
  last_name: Sequelize.STRING,
  party: Sequelize.STRING,
  status: Sequelize.STRING,
  individual_contrib: Sequelize.FLOAT,
  pac_contrib: Sequelize.FLOAT,
  total_contrib: Sequelize.FLOAT,
  disbursements: Sequelize.FLOAT
}, {
  underscored: true,
  getterMethods: {
    full_name() {
      return this.first_name + ' ' + this.last_name
    }
  },

  setterMethods: {
    full_name(val) {
      var [first, last] = val.indexOf(',') > 0 ? val.split(', ').reverse() : val.split(' ');
      [first,last] = [first,last].map(n => n.substring(0,1).toUpperCase() + n.substring(1).toLowerCase());
      this.setDataValue('first_name', first);
      this.setDataValue('last_name', last);
    },
  }
});

// Build associations
db.Candidate.belongsTo(db.Race);
db.Race.hasMany(db.Candidate);
db.sequelize.sync();

// API / DB Loaders
db.loadAll = function(){
  return Promise.all(
    Object.keys(require('./states.json')).map(state => this.loadState(state))
  ).then(function(states){
    db.Update.create({
      success: true
    });
  }).catch(e => {
    db.Update.create({
      success: false,
      error: e.message
    });
  })
}

db.loadState = function(state){
  return got(`https://api.propublica.org/campaign-finance/v1/${config.year}/races/${state}.json`, {
    headers: {
      'X-API-Key': config.campaign_finance_key
    },
    json: true
  }).then( res => { // Build Races
    var races = {};
    for(var race_data of res.body.results){
      const [race_uri, state, race] = race_data.district.match(/\/races\/([A-Z]{2})\/([\w\/]*)\.json/);
      const district = race === 'senate' ? 0 : parseInt(race.match(/house\/(\d*)/)[1]);
      races[state+'-'+district] = {state: state, district: district}
    }
    return Promise.all([
      res,
      Promise.all(Object.values(races).map(race => {
        return db.Race.findOrCreate({where: {
          state: race.state,
          district: race.district,
        }})
      }))
    ]);
  }).then( ([res, races]) => { // Build Candidates
    var raceDict = {};
    var raceIds = [];
    for(const [race, created] of races){
      raceDict[race.state+"-"+race.district] = race;
      raceIds.push(race.id);
    }
    return Promise.all([
      res,
      raceDict,
      db.Candidate.destroy({where: {race_id: raceIds}})
    ])
  }).then( ([res, raceDict]) => {
    return Promise.all(
    res.body.results.filter(d => d.candidate).map(race_data => {
      const [race_uri, state, race] = race_data.district.match(/\/races\/([A-Z]{2})\/([\w\/]*)\.json/);
      const district = race === 'senate' ? 0 : parseInt(race.match(/house\/(\d*)/)[1]);
      return Promise.all([
        got(`https://api.propublica.org/campaign-finance/v1/${config.year}${race_data.candidate.relative_uri}`, {
          headers: {'X-API-Key': config.campaign_finance_key},
          json: true
        }),
        raceDict[state+'-'+district].update({
          total_contrib: 0,
          total_disbursements: 0
        })
      ]).then( ([res, race]) => {
        return Promise.all([
          db.Candidate.create({
            race_id: race.id,
            fec_id: res.body.results[0].id,
            full_name: res.body.results[0].name,
            party: res.body.results[0].party.substring(0,1),
            status: res.body.results[0].status,
            individual_contrib: res.body.results[0].total_from_individuals,
            pac_contrib: res.body.results[0].total_from_pacs,
            total_contrib: res.body.results[0].total_contributions,
            disbursements: res.body.results[0].total_disbursements,
          }),
          race.update({
            total_contrib: race.total_contrib + res.body.results[0].total_contributions,
            total_disbursements: race.total_disbursements + res.body.results[0].total_disbursements
          })
        ]);
      }).catch(e => {
        throw new Error(`Error in inner chain: ${e.stack}`);
      }) // End Inside Chain
    })); // End Promise.all
  }).catch(e => {
    throw new Error(`Error in outer chain: ${e.stack}`);
  }); // End .then
}

module.exports = db;