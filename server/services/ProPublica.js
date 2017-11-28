const got = require('got');
const config = require('./../config.json')[process.env.NODE_ENV || "development"];

module.exports = new function ProPublica(){
  this.getState = (state, tries) => {
    var self = this;
    if(!tries) tries = 1;
    return got(`https://api.propublica.org/campaign-finance/v1/${config.year}/races/${state}.json`, {
      headers: {
        'X-API-Key': config.campaign_finance_key
      },
      json: true
    }).then( res => {
      if(res.statusCode != 200) console.log('STATE RESPONSE UNUSUAL', res.statusCode)
      return res.body.results;
    }).catch(e => {
      if(tries < 5){
        return self.getState(state, tries+1);
      }
    });
  };

  this.getCandidate = (id, tries) => {
    var self = this;
    if(!tries) tries = 1;
    return got(`https://api.propublica.org/campaign-finance/v1/${config.year}/candidates/${id}.json`, {
      headers: {'X-API-Key': config.campaign_finance_key},
      json: true
    }).then(res => {
      if(res.statusCode != 200) console.log('CANDIDATE RESPONSE UNUSUAL', res.statusCode)
      return res.body.results[0];
    }).catch(e => {
      if(tries < 5){
        return self.getCandidate(id, tries+1);
      }
      return false;
    });
  };
}