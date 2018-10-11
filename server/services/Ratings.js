const got = require('got');
const cheerio = require('cheerio');
const config = require('./../config.json')[process.env.NODE_ENV || "development"];
const Nightmare = require('nightmare');
const StateNames = require('./../data/states.json').abbreviations
module.exports = new function Ratings(){
  this.getCookPolitical = () => {
    const SenateScoreMap = [0,1,2,4,6,7,8];
    const HouseScoreMap = {
      "solid-seats-d": 0,
      "modal-from-table-likely-d": 1,
      "modal-from-table-lean-d": 2,
      "modal-from-table-tossup-d": 3,
      "solid-seats-r": 8,
      "modal-from-table-likely-r": 7,
      "modal-from-table-lean-r": 6,
      "modal-from-table-tossup-r": 5
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
    return Nightmare({ show: false })
      .goto('https://docs.google.com/spreadsheets/d/e/2PACX-1vT4KY7cdB2oiA8_Qlfjuei0O9LkApgXMnyUm4pcW2KR5pKsTRcEcnC-UoSB8LfqljT1ktFI5e9CPJUn/pubhtml#')
      .wait('table.waffle')
      .evaluate(() => {
        const transformScore = (s) => {
          s = parseInt(s);
          if(s < 4) return s-1;
          if(s > 4) return s+1;
          return s;
        }
        var data = {};
        for(var row of document.querySelectorAll('div[id="0"] table.waffle tbody tr:not(:first-of-type)')){
          const state = row.querySelector('td:first-of-type').innerText;
          const score = row.querySelector('td:nth-of-type(7)').innerText;
          data[state] = transformScore(score);
        }
        for(var row of document.querySelectorAll('div[id="2083419594"] table.waffle tbody tr:not(:first-of-type)')){
          const state = row.querySelector('td:first-of-type').innerText;
          var district = row.querySelector('td:nth-of-type(2)').innerText;
          const score = row.querySelector('td:nth-of-type(8)').innerText;
          if(district == 'AL' || parseInt(district) == 0) district = 1;
          data[state+"-"+district] = transformScore(score);
        }
        return data;
      })
      .end()
      .then(result => {
        var data = {};
        for(var key of Object.keys(result)){
          if(StateNames[key])
            data[StateNames[key]+'-0'] = result[key];
          else if(key.match(/[A-Z]{2}-[0-9]{1,2}/))
            data[key] = result[key];
        }
        return data;
      })
      .catch(error => {
        console.error('Nightmare Failed:', error);
      });
  };

  this.getInsideElections = () => {
    const SenateScoreMap = [4,3,2,1,0,5,6,7,8];
    const HouseScoreMap = [4,3,2,1,5,6,7];
    return Promise.all([
      got('https://insideelections.com/ratings/senate')
      .then(res => {
        var results = {};
        const $ = cheerio.load(res.body);
        $('table.ratings[class*="id-"]').each( (i, table) => {
          $(table).find('tr:not(:first-of-type)').each( (j, row) => {
            results[$(row).find('.state').text()+"-0"] = SenateScoreMap[i];
          });
        });
        return results;
      }),
      got('https://insideelections.com/ratings/house')
      .then(res => {
        var results = {};
        const $ = cheerio.load(res.body);
        $('table.ratings:not(.seats-in-play)').each( (i, table) => {
          $(table).find('tr:not(:first-of-type)').each( (j, row) => {
            const [state, district] = ['state', 'district'].map(k => $(row).find('.'+k).text());
            results[state+"-"+district] = SenateScoreMap[i];
          });
        });
        return results;
      })
    ]).then( ([senate, house]) => Object.assign({},senate,house));
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