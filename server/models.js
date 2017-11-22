"use strict";
const Sequelize = require("sequelize");

const config = require('config.json')[process.env.NODE_ENV || "development"];
const db = {};
db.sequelize = new Sequelize(config.DB_URI);

db.Race = db.sequelize.define('race', {
  state: Sequelize.STRING,
  district: Sequelize.INTEGER, // 0 if senate, district # if house
  total_receipts: Sequelize.INTERGER,
  total_disbursements: Sequelize.INTEGER
}, {
  classMethods: {
    associate: function(models) {
      db.Race.hasMany(db.Candidate);
    }
  },
  instanceMethods: { },
  indexes: [ ]
});

db.Candidate = db.sequelize.define('candidate', {
  first_name: Sequelize.STRING,
  last_name: Sequelize.STRING,
  party: Sequelize.STRING,
  status: Squelize.STRING,
  individual_receipts: Sequelize.INTEGER,
  pac_receipts: SEQUELIZE.INTEGER,
  disbursements: SEQUELIZE.INTEGER
}, {
  underscore: true,
  classMethods: {
    associate: function(models) {
      db.Candidate.belongsTo(db.Race);
    }
  },
  instanceMethods: { },
  indexes: [ ]
});

// Build associations
Object.keys(db).forEach(function(modelName) {
  if ("associate" in db[modelName]) {
    db[modelName].associate(db);
  }
});

module.exports = db;