module.exports = new function Twitter() {
  this.countTweets = query => {
    if(Array.isArray(query)) return Promise.all(query.map(q => this.countTweets(q)));
    var count = 0;
  }
}