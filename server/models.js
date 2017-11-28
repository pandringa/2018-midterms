"use strict";
const Sequelize = require("sequelize");
const nameify = require('./helpers/nameify');
const config = require('./config.json')[process.env.NODE_ENV || "development"];
const db = {
  sequelize: new Sequelize(config.db_uri),
  Op: Sequelize.Op,
};

// Method from https://hackernoon.com/functional-javascript-resolving-promises-sequentially-7aac18c4431e 
Promise.prototype.serial = funcs => {
  return funcs.reduce((promise, func) =>
    promise.then(result => func().then(Array.prototype.concat.bind(result))),
    Promise.resolve([]))
}

db.Update = db.sequelize.define('updates', {
  success: Sequelize.BOOLEAN,
  error: Sequelize.TEXT
}, {
  underscored: true
});

db.Race = db.sequelize.define('race', {
  state: Sequelize.STRING,
  district: Sequelize.INTEGER, // 0 if senate, district # if house
  total_contrib: Sequelize.INTEGER,
  total_disbursements: Sequelize.INTEGER,
  cook_rating: Sequelize.INTEGER,
  inside_rating: Sequelize.INTEGER,
  crystal_rating: Sequelize.INTEGER,
  incumbent_party: Sequelize.STRING
}, {
  underscored: true
});

db.Candidate = db.sequelize.define('candidate', {
  fec_id: Sequelize.STRING,
  first_name: Sequelize.STRING,
  last_name: Sequelize.STRING,
  party: Sequelize.STRING,
  status: Sequelize.STRING,
  individual_contrib: Sequelize.FLOAT,
  pac_contrib: Sequelize.FLOAT,
  total_contrib: Sequelize.FLOAT,
  disbursements: Sequelize.FLOAT
}, {
  underscored: true,
  getterMethods: {
    full_name() {
      return this.first_name + ' ' + this.last_name
    }
  },

  setterMethods: {
    full_name(val) {
      var name = nameify(val);
      this.setDataValue('first_name', name.first + (name.middle ? ' ' + name.middle : '') );
      this.setDataValue('last_name', name.last);
    },
  }
});

// Build associations
db.Candidate.belongsTo(db.Race);
db.Race.hasMany(db.Candidate);
db.sequelize.sync();

module.exports = db;