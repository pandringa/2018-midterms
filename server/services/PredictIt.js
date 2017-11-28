const got = require('got');
const config = require('./../config.json')[process.env.NODE_ENV || "development"];

module.exports = new function PredictIt(){
  /**
  * Loads Senate betting odds from PredictIt
  * @return Senate betting odds of incumbent victory
  * e.g. 
  * {
  *   "WV": 0.78,
  *   "MA": 0.90,
  *   ...
  * }
  */
  this.getSenate = () => {
    return got(`https://www.predictit.org/api/marketdata/group/54`, {
      headers: {
        'Accept': 'application/json'
      },
      json: true
    }).then(res => {
      var results = {};
      for(var market of res.body.Markets){
        const matches = market.TickerSymbol.match(/^[A-Z]+\.([A-Z]{2})SENATE\.([0-9]{4})$/)
        if(matches){
          const [ticker, state, year] = matches;
          if(parseInt(year) == 2018){
            results[state] = market.Contracts[0].LastTradePrice;
          }
        }
      }
      return results;
    });
  }
}