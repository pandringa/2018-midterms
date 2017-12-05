function ElectionMap(element) {
  const self = this;
  const STATE_FP = {};
  var centered, RACES_DATA;

  const width = $(element).width(),
        height = width / 1.5;

  $('.race-list').attr('style', `max-height: ${height * 0.8}px;`)

  // Set up click listeners
  $(element).find('.zoom-out')
    .on('click', e => self.toggleZoom(null));


  $('.interactive-list .toggle.buttons .button')
    .on('click', e => 
      self.renderList({
        body: $(e.target).data('body')
      })
    );

  $('.interactive-list .menu.secondary .item')
    .on('click', e => 
      self.renderList({
        tab: $(e.target).data('tab')
      })
    );

  // Set up Map
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

  // load geodata
  d3.json('/server/geodata/us.json', (error, us) => {
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
        .attr('data-race', d => STATE_FP[d.properties.STATEFP]+'-'+parseInt(d.properties.CD115FP))
        .on('click', d => {
          const district = STATE_FP[d.properties.STATEFP]+'-'+parseInt(d.properties.CD115FP);
          g.select('.district.active').classed('active', false);
          g.select('.district[data-race="'+district+'"]').classed('active', true);
          self.showRace(district);
        })
        .on('mouseover', d => self.mouseOver(STATE_FP[d.properties.STATEFP]+'-'+parseInt(d.properties.CD115FP)))
        .on('mouseout', d => self.mouseOut(STATE_FP[d.properties.STATEFP]+'-'+parseInt(d.properties.CD115FP)))
    
    // Draw states
    g.append('g')
      .attr('id', 'states')
      .selectAll('path')
        .data(topojson.feature(us, us.objects.states).features)
      .enter().append('path')
        .attr('d', path)
        .attr('class', 'state')
        .attr('data-race', s => s.properties.STUSPS+"-0")
        .on('click', d => {
          self.toggleZoom(d);
          self.filterState(d.properties.STUSPS);
        })
        .on('mouseover', d => self.mouseOver(d.properties.STUSPS+"-0"))
        .on('mouseout', d => self.mouseOut(d.properties.STUSPS+"-0"))


    // Draw paths around states
    g.append('path')
        .datum(topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; }))
        .attr('id', 'state-borders')
        .attr('d', path);

    $(element).find('.loader').remove();
  });

  // Load election data
  d3.json('http://localhost:3000/races', (error, raceData) => {
    RACES_DATA = raceData;
    self.renderList({
      body: 'senate',
      tab: 'finance'
    });
  });

  this.toggleZoom = function toggleZoom(d) {
    var x, y, k;

    if (d && centered !== d) {
      [x,y] = path.centroid(d);
      const [[left, top], [right, bottom]] = path.bounds(d);
      const widthFactor = (right-left)/width,
            heightFactor = (bottom-top)/height;
      k = Math.min(1/widthFactor, 1/heightFactor);
      centered = d;

      self.renderList({
        body: 'house',
        state: d.properties.STUSPS
      });

    } else {
      x = width / 2;
      y = height / 2;
      k = 1;
      centered = null;

      self.renderList({
        state: 'all'
      });
    }

    d3.select(element)
      .classed('zoomed', centered);

    g.selectAll('.active' + (d ? ', .state[data-race="'+d.properties.STUSPS+'-0"]' : ''))
      .classed('active', centered && (d => d === centered))

    g.transition()
      .duration(750)
      .attr('transform', 'translate(' + width / 2 + ',' + height / 2 + ')scale(' + k + ')translate(' + -x + ',' + -y + ')')
      .style('stroke-width', 1.5 / k + 'px');  
  }

  this.mouseOver = label => 
    $(`[data-race="${label}"]`).addClass('hover');
  
  this.mouseOut = label => 
    $(`[data-race="${label}"]`).removeClass('hover');

  var currentOptions = {};
  this.renderList = function renderList(options) {
    options.body = options.body || currentOptions.body || 'senate';
    options.tab = options.tab || currentOptions.tab || 'finance';
    options.state = options.state || currentOptions.state

    if(options.tab == 'prediction'){
      console.log('prediction')
      options.sortDisplay = r => r.cook_score;
      options.sortFn = (a,b) => a-b;
    } else if(options.tab == 'finance') {
      console.log('finance')
      options.sortDisplay = r => r.total_receipts > 1000000 ? 
        numeral(r.total_receipts).format('$0.00a') :
        numeral(r.total_receipts).format('$0a');
      options.sortFn = (a, b) => d3.descending(a.total_receipts, b.total_receipts)
    } else if(options.tab == 'attention') {
      options.sortDisplay = r => numeral(r.news_total).format('0a');
      options.sortFn = (a, b) => d3.descending(a.news_total, b.news_total)
    }
    
    if(options.body != currentOptions.body){
      $('.interactive-list .toggle.buttons')
        .find('.active, [data-body="'+options.body+'"]')
        .toggleClass('active')
    }
    if(options.tab != currentOptions.tab){
      $('.interactive-list .menu.secondary')
        .find('.active, [data-tab="'+options.tab+'"]')
        .toggleClass('active')
    }

    $('.interactive-map').removeClass(options.body == 'senate' ? 'house' : 'senate')
    $('.interactive-map').addClass(options.body)

    // Build list
    var races = RACES_DATA[options.body];

    if(options.state && options.state != 'all')
      races = races

    const list = d3.select('.race-list')
      .selectAll('div.race')
        .data(races
                .filter(r => !(options.state && options.state != 'all') || r.state === options.state)
          , r => r.state+'-'+r.district+'-'+options.sortDisplay(r))
        // .sort(options.sortFn)

    // New items
    const race = list.enter().append('div')
        .attr('class', 'race item')
        .attr('data-race', d => d.state+"-"+d.district)
        .on('mouseover', d => self.mouseOver(d.state+"-"+d.district))
        .on('mouseout', d => self.mouseOut(d.state+"-"+d.district))
        // .sort(options.sortFn)

    const race_content = race.append('div')
      .attr('class', 'race-content')
      
    // content.append('div')
    //   .attr('class', d => 'name' + (d.candidates[0].party == 'R' ? ' red' : d.candidates[0].party == 'D' ? ' blue' : ''))
    //   .text(d => `${d.candidates[0].first_name} ${d.candidates[0].last_name} (${d.candidates[0].party})`)

    race_content.append('div')
      .attr('class', 'name')
      .text( r => 
        r.state_name + ' ' + 
        (r.district > 0 ? 
          numeral(r.district).format('0o') :
          "Senate")
      )

    race_content.append('div')
      .attr('class', 'status')
      .text(d => `Incumbent: ${d.candidates[0].first_name} ${d.candidates[0].last_name} (${d.candidates[0].party})`)

    race.append('div')
      .attr('class', 'datapoint')
    
    // Update items
    list
      .sort(options.sortFn)
      .selectAll('.datapoint')
      .text(options.sortDisplay)
    
    // Remove items
    list.exit().remove()
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