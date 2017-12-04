const got = require('got');
const config = require('./../config.json')[process.env.NODE_ENV || "development"];

module.exports = new function FEC(){
  this.requestCandidates = options => {
    if(!options) options = {};
    const fec_options = {
      per_page: options.per_page || 100,
      page: options.page || 1,
      cycle: options.cycle || config.year,
      api_key: options.api_key || config.fec_key,
      state: options.state,
      district: options.district,
    }
    const fec_api = Object.keys(fec_options).reduce( (url, key) => {
      if(fec_options[key] == null) return url;
      return url + `${key}=${fec_options[key]}&`
    }, 'https://api.open.fec.gov/v1/candidates/totals/?');
    console.log(fec_api)
    return got(fec_api, {json: true})
      .then(res => {
        console.log("LOADED API", res.body.pagination);
        return res;
      })
  }
}