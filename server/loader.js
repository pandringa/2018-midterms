const Ratings = require('./services/Ratings');
const ProPublica = require('./services/ProPublica.js');
const db = require('./models');
const Op = db.Op;

module.exports = new function Loader(){
  this.loadRatings = () => {
    return Ratings.getPrediction('all')
      .then( data => {
        return Promise.all(Object.keys(data).map( key => {
          const [state, district] = key.split('-');
          var updates = {};
          for(var name of Object.keys(data[key]))
            updates[name+'_rating'] = data[key][name]
          if(district != 0 && !updates['inside_rating']){
            updates['inside_rating'] = (updates['cook_rating'] + updates['crystal_rating']) < 8 ? 0 : 8;
          }
          return db.Race.update(updates, {
            where: {
              state: state,
              district: parseInt(district)
            }
          });
        }));
      })
  }

  this.loadAllStates = function(){
    return Promise.all(
      Object.keys(require('./data/states.json').names).map(state => this.loadState(state))
    ).then(function(states){
      return db.Update.create({
        success: true
      });
    }).catch(e => {
      return db.Update.create({
        success: false,
        error: e.message
      });
    })
  }

  this.loadState = function(state){
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
          if(!candidate_data) return;
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
}
