const got = require('got');
const config = require('./../config.json')[process.env.NODE_ENV || "development"];

module.exports = new function BingNews(){
  function randomDelay() {
    return new Promise(function(resolve) { 
       setTimeout(resolve, Math.round(Math.random() * 10000));
    });
  }

  this.search = (query, options) => {
    const self = this;
    if(!options) options = {};
    options.retryCount = (options.retryCount || 0) + 1;

    const bing_options = {
      mkt: options.mkt || 'en-US',
      freshness: options.freshness || 'week',
      count: options.count || 10,
      offset: options.offset || 0,
      q: query
    }
    const bing_api = Object.keys(bing_options).reduce( (url, key) => {
      if(bing_options[key] == null) return url;
      return url + `${encodeURIComponent(key)}=${encodeURIComponent(bing_options[key])}&`
    }, 'https://api.cognitive.microsoft.com/bing/v7.0/news/search?');
    console.log('Loading API: ', bing_api);
    return got(bing_api, {
      json: true,
      headers: {
        'Ocp-Apim-Subscription-Key': config.bing_key
      }
    }).catch(e => {
      if(options.retryCount > 5){
        console.log('Out of retries!!');
        return;
      }
      return randomDelay().then(() => {
        console.log('Retrying...');
        return self.search(query, options);
      });
    })
  }

  this.countResults = query => {
    return this.search(query, {
      count: 1
    }).then(res => {
      console.log('CODE: ', res.statusCode);
      return res.body.totalEstimatedMatches;
    })
  }
}