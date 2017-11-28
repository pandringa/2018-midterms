const got = require('got');
const config = require('./config.json')[process.env.NODE_ENV || "development"];

module.exports = new function ProPublica(){
  this.getState = state => {
    return got(`https://api.propublica.org/campaign-finance/v1/${config.year}/races/${state}.json`, {
      headers: {
        'X-API-Key': config.campaign_finance_key
      },
      json: true
    }).then(res => {
      return res.body.results;
    });
  };

  this.getCandidate = id => {
    return got(`https://api.propublica.org/campaign-finance/v1/${config.year}/candidates/${id}.json`, {
      headers: {'X-API-Key': config.campaign_finance_key},
      json: true
    }).then(res => {
      return res.body.results[0];
    })
  };
}