// Make_topojson.js
// Converts shapefiles for states and districts into topojson
// Shapefiles from https://www.census.gov/geo/maps-data/data/tiger-cart-boundary.html


const fs = require('fs'),
      path = require('path'),
      shapefile = require("shapefile"),
      topojson = require("topojson-server");

Promise.all([
  shapefile.read(path.join(__dirname, 'cb_2016_us_cd115_20m', 'cb_2016_us_cd115_20m.shp')),
  shapefile.read(path.join(__dirname, 'cb_2016_us_state_20m', 'cb_2016_us_state_20m.shp'))
]).then( ([districtData, stateData]) => {
  const topo = topojson.topology({
    states: stateData,
    districts: districtData
  });

  return fs.writeFile(path.join(__dirname, 'us.json'), JSON.stringify(topo), () => console.log('Finished writing to to us.json'))
}).catch(e => console.error(e.stack));

