const express = require('express');

const ProPublica = require('./ProPublica');
const config = require('config.json')[process.env.NODE_ENV || "development"];

// If DB is empty
  // Load data from ProPublica
function loadData() {
  
}


// For Request:
  // Read Data from DB
  // If data > 1 day old, queue new data


// CRON JOB - Load Data from ProPublica once a week