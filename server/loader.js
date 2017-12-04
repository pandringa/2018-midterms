const Ratings = require('./services/Ratings');
const FEC = require('./services/FEC.js');
const BingNews = require('./services/BingNews.js');
const db = require('./models');
const config = require('./config.json')[process.env.NODE_ENV || "development"];
const state_districts = require('./data/districts.json')
const state_names = require('./data/states.json').names

const Loader = new function Loader(){
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

  this.loadNewsCounts = () => {
    function formatNum(n){
      if(n == 1) return n+"st";
      if(n == 2) return n+"nd";
      if(n == 3) return n+"rd";
      return n+"th";
    }
    return db.Candidate.findAll({ where: {}, include: ['race'] })
      .then(candidates => {
        return Promise.all(candidates.map(c => {
            // ("Virginia 10th" OR "VA-10" OR "Barbara Comstock" OR "Julian Modica") AND ("2018" OR "midterm" OR "race")
            var query = "(";
            query += `("${state_names[c.race.state]}" AND "${c.race.district > 0 ? formatNum(c.race.district) : 'Senate'}")`
            query += ` OR "${c.race.state}-${c.race.district}" OR midterm OR (2018 AND (race OR election OR cycle))`
            query += `) AND (${c.full_name} OR ${c.last_name})`
            
            return BingNews.countResults(query)
              .then( num => c.update({ news_hits: num}) );
        }));
      })
      .then(updated => {
        return db.Candidate.findAll({
           attributes: ['race_id', [db.sequelize.fn('SUM', db.sequelize.col('news_hits')), 'news_hits_total']],
           group: 'race_id'
        })
      }).then(race_sums => {
        return Promise.all(race_sums.map(race => {
          db.Race.update({
            news_total: parseInt(race.dataValues.news_hits_total),
          },{
            where: { id: race.dataValues.race_id }
          })
        }));
      });
  }

  this.loadAllCandidates = () => {
    const self = this;
    return Promise.all([
      db.Candidate.destroy({where: {}}),
      db.Race.destroy({where: {}})
    ]).then(destroyed => {
      var races = [];
      for(var state of Object.keys(state_districts)){
        if(state_districts[state].senate.includes( (config.year%6) == 0 ? 3 : (config.year%6)/2 )) 
          races.push({state: state, district: 0}); // Check senate class if mod (year) is right
        for(var n=1; n<=state_districts[state].house; n++)
          races.push({state: state, district: n}); // nth House district
      }
      return db.Race.bulkCreate(races);
    }).then(races => {
      return self.loadCandidates()
    }).then(created => {
      return db.Update.create({
        success: true
      });
    }).catch(e => {
      console.error(e.stack)
      return db.Update.create({
        success: false,
        error: e.message
      });
    })
  }

  this.loadCandidates = (page) => {
    const self = this;
    if(!page || typeof page != 'number') page = 1;
    return FEC.requestCandidates({
      page: page
    }).then(res => {
      var promises = res.body.results
        .filter( candidate => candidate.cycles.includes(2018) && candidate.office != 'P' )
        .map( candidate_data => {
          return db.Race.find({where: {
            state: candidate_data.state,
            district: (candidate_data.office == 'H' && candidate_data.district == '00') ? 1 : parseInt(candidate_data.district),
          }}).then( race => {
            if(!race){
              console.log(`NO RACE FOUND FOR DISTRICT ${candidate_data.state}-${candidate_data.district}`)
              return false;
            } 
            return Promise.all([
              db.Candidate.create({
                race_id: race.id,
                fec_id: candidate_data.candidate_id,
                full_name: candidate_data.name,
                party: candidate_data.party.substring(0,1),
                status: candidate_data.incumbent_challenge,
                receipts: Math.round(candidate_data.receipts),
                disbursements: Math.round(candidate_data.disbursements),
              }),
              race.update({
                total_receipts: race.total_receipts + Math.round(candidate_data.receipts),
                total_disbursements: race.total_disbursements + Math.round(candidate_data.disbursements)
              })
            ]);
          });
        });

      // Recurse if necessary
      if(res.body.pagination.page < res.body.pagination.pages)
        promises.push( self.loadCandidates(page+1) );

      return Promise.all(promises);
    });
  }
}

module.exports = Loader;

if(require.main === module){
  Loader.loadAllCandidates()
    .then(states => Loader.loadRatings())
    .then(ratings => console.log('Done!'));
}
