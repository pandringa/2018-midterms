"use strict";
const Sequelize = require("sequelize");
const got = require('got');
const ProPublica = require('./ProPublica.js');
const nameify = require('./nameify.js')
const config = require('./config.json')[process.env.NODE_ENV || "development"];
const db = {
  sequelize: new Sequelize(config.db_uri)
};

// Method from https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e 
Promise.prototype.serial = funcs => {
  return funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]))
}

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
  total_disbursements: Sequelize.INTEGER,
  cook_rating: Sequelize.INTEGER,
  inside_rating: Sequelize.INTEGER,
  crystal_rating: Sequelize.INTEGER,
  incumbent_party: Sequelize.STRING
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
      var name = nameify(val);
      this.setDataValue('first_name', name.first + (name.middle ? ' ' + name.middle : '') );
      this.setDataValue('last_name', name.last);
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
  return ProPublica.getState(state)
  .then( state_races => { // Build Races
    var races = {};
    for(var race_data of state_races){
      var district;
      if(race_data.district == null){
        district = 1;
      }else{
        const race = race_data.district.match(/\/races\/[A-Z]{2}\/([\w\/]*)\.json/)[1];
        district = race === 'senate' ? 0 : parseInt(race.match(/house\/(\d*)/)[1]);
      }
      races[state+'-'+district] = {state: state, district: district}
    }
    return Promise.all([
      state_races,
      Promise.all(Object.values(races).map(race => {
        return db.Race.findOrCreate({where: {
          state: race.state,
          district: race.district,
        }})
      }))
    ]);
  }).then( ([state_races, races]) => { // Build Candidates
    var raceDict = {};
    var raceIds = [];
    for(const [race, created] of races){
      raceDict[race.state+"-"+race.district] = race;
      raceIds.push(race.id);
    }
    return Promise.all([
      state_races,
      raceDict,
      db.Candidate.destroy({where: {race_id: raceIds}})
    ])
  }).then( ([state_races, raceDict]) => {
    return Promise.all(
    state_races.filter(d => d && d.candidate && d.district)
    .map(race_data => {
      const [race_uri, state, race] = race_data.district.match(/\/races\/([A-Z]{2})\/([\w\/]*)\.json/);
      const district = race === 'senate' ? 0 : parseInt(race.match(/house\/(\d*)/)[1]);
      return Promise.all([
        ProPublica.getCandidate(race_data.candidate.id),
        raceDict[state+'-'+district].update({
          total_contrib: 0,
          total_disbursements: 0
        })
      ]).then( ([candidate_data, race]) => {
        var race_updates = {
          total_contrib: race.total_contrib + candidate_data.total_contributions,
          total_disbursements: race.total_disbursements + candidate_data.total_disbursements
        };
        if(candidate_data.status == 'I') 
          race_updates.incumbent_party = candidate_data.party.substring(0,1);
        
        return Promise.all([
          db.Candidate.create({
            race_id: race.id,
            fec_id: candidate_data.id,
            full_name: candidate_data.name,
            party: candidate_data.party.substring(0,1),
            status: candidate_data.status,
            individual_contrib: candidate_data.total_from_individuals,
            pac_contrib: candidate_data.total_from_pacs,
            total_contrib: candidate_data.total_contributions,
            disbursements: candidate_data.total_disbursements,
          }),
          race.update(race_updates)
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