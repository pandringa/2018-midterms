const got = require('got');
const cheerio = require('cheerio');
const config = require('./config.json')[process.env.NODE_ENV || "development"];

module.exports = new function Ratings(){
  this.getCookPolitical = () => {
    return got('http://cookpolitical.com/ratings/senate-race-ratings')
    .then(res => {
      var results = {};
      const $ = cheerio.load(res.body);
      $('.ratings-detail-page-table').each( (i, el) => {
        $(el).find('.ratings-detail-page-table-7-column-cell ul').each( (j, cell) => {
          $(cell).find('li a').each( (n, race) => {
            var matches = $(race).text().match(/^[A-Z]{2}/)
            if(matches){
              var score = j;
              if(score > 2) score++;
              if(score > 5) score++;
              results[matches[0]] = score;
            }
          });
        });
      });
      return results;
    });
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