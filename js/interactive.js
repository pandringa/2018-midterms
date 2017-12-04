function ElectionMap(element) {
  const self = this;
  const STATE_FP = {};

  var centered = null;

  const width = $(element).width() + 30,
        height = width / 1.5;

  $(element).find('.zoom-out')
    .on('click', e => self.toggleZoom(null));

  const projection = d3.geo.albersUsa()
    .scale(1070)
    .translate([width / 2, height / 2]);
  
  const path = d3.geo.path()
    .projection(projection);

  const svg = d3.select(element).append('svg')
    .attr('width', width)
    .attr('height', height);

  svg.append('rect')
    .attr('class', 'background')
    .attr('width', width)
    .attr('height', height)
    .on('click', self.toggleZoom);

  const g = svg.append('g');

  d3.json('/server/geodata/us.json', function(error, us) {
    if (error) throw error;

    for(var state of us.objects.states.geometries){
      STATE_FP[state.properties.STATEFP] = state.properties.STUSPS;
    }

    // Draw districts
    g.append('g')
      .attr('id', 'districts')
      .selectAll('path')
        .data(topojson.feature(us, us.objects.districts).features)
      .enter().append('path')
        .attr('d', path)
        .attr('class', 'district')
        .attr('id', d => STATE_FP[d.properties.STATEFP]+'-'+d.properties.CD115FP)
        .on('click', d => {
          const district = STATE_FP[d.properties.STATEFP]+'-'+d.properties.CD115FP;
          g.select('.district.active').classed('active', false);
          g.select('#'+district).classed('active', true);
          self.showRace(district);
        });

    // Draw states
    g.append('g')
      .attr('id', 'states')
      .selectAll('path')
        .data(topojson.feature(us, us.objects.states).features)
      .enter().append('path')
        .attr('d', path)
        .attr('class', 'state')
        .attr('id', s => s.properties.STUSPS)
        .on('click', d => {
          self.toggleZoom(d);
          self.filterState(d.properties.STUSPS);
        });

    // Draw paths around states
    g.append('path')
        .datum(topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; }))
        .attr('id', 'state-borders')
        .attr('d', path);

    $(element).find('.loader').remove();
  });

  this.toggleZoom = function toggleZoom(d) {
    var x, y, k;

    if (d && centered !== d) {
      var centroid = path.centroid(d);
      x = centroid[0];
      y = centroid[1];
      k = 4;
      centered = d;
    } else {
      x = width / 2;
      y = height / 2;
      k = 1;
      centered = null;
    }

    d3.select(element)
      .classed('zoomed', centered);

    g.selectAll('.active' + (d ? ', #'+d.properties.STUSPS : ''))
      .classed('active', centered && (d => d === centered))

    g.transition()
      .duration(750)
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')scale(' + k + ')translate(' + -x + ',' + -y + ')')
      .style('stroke-width', 1.5 / k + 'px');  
  }

  this.showRace = function showRace(district) {
    console.log(district);
  }

  this.filterState = function filterState(state) {
    console.log(state);
  }
}

$(document).ready(() => {
  const map = new ElectionMap('#electionmap');

  $('.interactive-list .menu .item').tab();
});