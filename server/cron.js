"use strict";

const loader = require('./loader');

loader.loadAllStates()
  .then(states => loader.loadRatings())
  .then(ratings => console.log('Done!'));