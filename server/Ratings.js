const got = require('got');
const cheerio = require('cheerio');
const config = require('./config.json')[process.env.NODE_ENV || "development"];

module.exports = new function Ratings(){
  this.getCookPolitical = () => {
    const SenateScoreMap = [0,1,2,4,6,7,8];
    const HouseScoreMap = {
      "solid-seats-d": 0,
      "modal-from-table-likely-d": 1,
      "modal-from-table-lean-d": 2,
      "modal-from-table-tossup-d": 4,
      "solid-seats-r": 8,
      "modal-from-table-likely-r": 7,
      "modal-from-table-lean-r": 6,
      "modal-from-table-tossup-r": 4
    };
    return Promise.all([
      got('http://cookpolitical.com/ratings/senate-race-ratings')
      .then(res => {
        var results = {};
        const $ = cheerio.load(res.body);
        $('.ratings-detail-page-table').each( (i, el) => {
          $(el).find('.ratings-detail-page-table-7-column-ul').each( (j, cell) => {
            $(cell).find('li a').each( (n, race) => {
              var matches = $(race).text().match(/^[A-Z]{2}/)
              if(matches){
                var score = SenateScoreMap[j];
                results[matches[0]+"-0"] = score;
              }
            });
          });
        });
        return results;
      }),
      got('http://cookpolitical.com/ratings/house-race-ratings')
      .then(res => {
        var results = {};
        const $ = cheerio.load(res.body);
        // $('#solid-seats-d .popup-table-data-row:not(.likely-d) a').each( (i, race) => {
        //   var matches = $(race).text().replace(/\s/m, '').match(/([A-Z]{2}).*-.*([0-9]{2})/)
        //   if(matches){
        //     const district = parseInt(matches[2]) == 0 ? 1 : parseInt(matches[2]);
        //     results[matches[1]+"-"+district] = 0;
        //   }
        // });
        // $('#solid-seats-r .popup-table-data-row a').each( (i, race) => {
        //   var matches = $(race).text().replace(/\s/m, '').match(/([A-Z]{2}).*-.*([0-9]{2})/)
        //   if(matches){
        //     const district = parseInt(matches[2]) == 0 ? 1 : parseInt(matches[2]);
        //     results[matches[1]+"-"+district] = 8;
        //   }
        // });
        $('.solid-seats-modal').each( (j, table) => {
          const score = HouseScoreMap[$(table).attr('id')];
          $(table).find('.popup-table-data-row a').each( (n, race) => {
            var matches = $(race).text().replace(/\s/m, '').match(/([A-Z]{2}).*-.*([0-9]{2})/)
            if(matches){
              const district = parseInt(matches[2]) == 0 ? 1 : parseInt(matches[2]);
              results[matches[1]+"-"+district] = score;
            }
          });
        });
        return results;
      })
    ]).then( ([senate, house]) => Object.assign({},senate,house));
  };

  this.getCrystalBall = () => {
    return "In progress"
  };

  this.getInsideElections = () => {
    return "In Progress"
  };

  this.getAll = () => {
    return Promise.all([
      this.getCookPolitical(),
      this.getCrystalBall(),
      this.getInsideElections()
    ]).then( predictions => {
      const predictionKeys = ['cook', 'crystal', 'inside']
      var results = {};
      for(var i=0; i<predictions.length; i++){
        for(var state of Object.keys(predictions[i])){
          if(!results[state]) results[state] = {};
          results[state][predictionKeys[i]] = predictions[i][state];
        }
      }
      return results;
    });
  };

  this.getPrediction = prediction => {
    switch (prediction.toLowerCase()) {
      case 'cookpolitical':
      case 'cook':
        return this.getCookPolitical();
      case 'crystalball':
      case 'crystal':
        return this.getCrystalBall();
      case 'insideelections':
      case 'inside':
        return this.getInsideElections();
      default:
        return this.getAll();
    }
  }
}