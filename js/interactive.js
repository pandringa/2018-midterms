function ElectionMap(element) {
  const self = this;
  const STATE_FP = {};
  const RATING_INFO = [
    {text: 'Solid D', color: '#1e4571'},
    {text: 'Likely D', color: '#265c91'},
    {text: 'Lean D', color: '#347abe'},
    {text: 'Tilt D', color: '#70a1d1'},
    {text: 'Toss Up', color: '#444'},
    {text: 'Tilt R', color: '#f37381'},
    {text: 'Lean R', color: '#ee384c'},
    {text: 'Likely R', color: '#be2839'},
    {text: 'Solid R', color: '#990012'}
  ]

  var centered, RACES_DATA;
  const width = $(element).width(),
        height = width / 1.5;

  $('#race-list').attr('style', `max-height: ${height * 0.8}px;`)

  // Set up click listeners
  $(element).find('.zoom-out')
    .on('click', e => self.toggleZoom(null));

  $('.interactive-detail .back')
    .on('click', e => self.hideRace())

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
        .on('click', d => self.showRace(STATE_FP[d.properties.STATEFP]+'-'+parseInt(d.properties.CD115FP)))
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
    const d = new Date(Date.parse(raceData.updated));
    const months = ['JAN', 'FEB', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUG', 'SEPT', 'OCT', 'NOV', 'DEC'];
    $('#updated').text(`UPDATED: ${months[d.getMonth()]}. ${d.getDate()} ${d.getFullYear()}`)
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

    g.selectAll('.zoom' + (d ? ', .state[data-race="'+d.properties.STUSPS+'-0"]' : ''))
      .classed('zoom', centered && (d => d === centered))

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
      options.sortDisplay = r => {
        const sum = [r.cook_rating, r.inside_rating, r.crystal_rating].reduce((c,i) => c + i, 0);
        const avg = Math.round(sum / 3.0);
        return RATING_INFO[avg].text;
      };
      options.sortFn = (a,b) => {
        const [aSum, bSum] = [a,b].map( r =>
          [r.cook_rating-4, r.inside_rating-4, r.crystal_rating-4].reduce((c,i) => c + i, 0)
        );
        return d3.ascending(Math.abs(aSum), Math.abs(bSum));
      };
      options.sortDisplayStyle = r => {
        const sum = [r.cook_rating, r.inside_rating, r.crystal_rating].reduce((c,i) => c + i, 0);
        const avg = Math.round(sum / 3.0);
        return `color: ${RATING_INFO[avg].color};`
      };

    } else if(options.tab == 'finance') {
      options.sortDisplay = r => r.total_receipts > 1000000 ? 
        numeral(r.total_receipts).format('$0.00a') :
        numeral(r.total_receipts).format('$0a');
      options.sortFn = (a, b) => d3.descending(a.total_receipts, b.total_receipts)
      options.sortDisplayStyle = false;
    } else if(options.tab == 'attention') {
      options.sortDisplay = r => numeral(r.news_total).format('0a');
      options.sortFn = (a, b) => d3.descending(a.news_total, b.news_total)
      options.sortDisplayStyle = false;
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

    currentOptions = options;

    self.hideRace();
    $('.interactive-map').removeClass(options.body == 'senate' ? 'house' : 'senate')
    $('.interactive-map').addClass(options.body)


    // Build list
    var races = RACES_DATA[options.body];

    $('.interactive-list .title').text(
      (options.state && options.state != 'all')
        ? races.find(r => r.state === options.state).state_name + ' Races'
        : 'All Races'
    );

    const list = d3.select('#race-list')
      .selectAll('div.race')
        .data(races
                .filter(r => !(options.state && options.state != 'all') || r.state === options.state)
          , r => r.state+'-'+r.district+'-'+options.sortDisplay(r))

    // New items
    const race = list.enter().append('div')
        .attr('class', 'race item')
        .attr('data-race', d => d.state+"-"+d.district)
        .on('mouseover', d => self.mouseOver(d.state+"-"+d.district))
        .on('mouseout', d => self.mouseOut(d.state+"-"+d.district))
        .on('click', d => self.showRace(d.state+"-"+d.district))

    const race_content = race.append('div')
      .attr('class', 'content')
      
    // content.append('div')
    //   .attr('class', d => 'name' + (d.candidates[0].party == 'R' ? ' red' : d.candidates[0].party == 'D' ? ' blue' : ''))
    //   .text(d => `${d.candidates[0].first_name} ${d.candidates[0].last_name} (${d.candidates[0].party})`)

    race_content.append('div')
      .attr('class', 'name')
      .text( r => 
        r.state_name + ' ' + 
        (r.district > 0
          ? numeral(r.district).format('0o')
          : "Senate")
      )

    race_content.append('div')
      .attr('class', 'status')
      .text(d => `Incumbent: ${d.candidates[0].first_name} ${d.candidates[0].last_name} (${d.candidates[0].party})`)

    race.append('div')
      .attr('class', 'datapoint')
    
    race.append('i')
      .attr('class', 'angle right icon')

    // Update items
    list
      .sort(options.sortFn)
      .selectAll('.datapoint')
      .text(options.sortDisplay)
      .attr('style', options.sortDisplayStyle)

    // Remove items
    list.exit().remove()
  }

  this.showRace = function showRace(district) {
    $('.interactive-sidebar').addClass('show-detail');
    $('.interactive-detail .loader').show();
    
    $('.interactive-map .active').removeClass('active');
    $('.interactive-map [data-race="'+district+'"]').addClass('active');
  
    d3.json('http://localhost:3000/race/'+district, (error, race) => {
      if(error) return console.error(error);

      // Update header
      $('.interactive-detail .title').text(
        race.state_name + ' ' + 
        (race.district > 0 ? 
          numeral(race.district).format('0o') + ' District' :
          'Senate Race')
      );
      $('.interactive-detail .statistic.finance .value').text(
        numeral(race.total_receipts).format('$0.00a')
      );
      $('.interactive-detail .statistic.attention .value').text(
        numeral(race.news_total).format('0a')
      );

      var avg = 0;
      for(var rating of ['cook_rating', 'inside_rating', 'crystal_rating']){
        avg += race[rating];
        $(`.${rating} td:last-of-type`)
          .text(RATING_INFO[race[rating]].text)
          .attr('style', `color: ${RATING_INFO[race[rating]].color};`);
      }
      avg = Math.round(avg / 3.0);
      $(`.average td:last-of-type`)
        .text(RATING_INFO[avg].text)
        .attr('style', `color: ${RATING_INFO[avg].color};`);


      // Create candidates
      const list = d3.select('#candidate-list')
      .selectAll('div.candidate')
        .data(race.candidates, c => c.id)

      // New candidates
      const candidate = list.enter().append('div')
        .attr('class', 'candidate item')

      const content = candidate.append('div')
        .attr('class', 'content')
        
      content.append('div')
        .attr('class', c => 'name' + (c.party == 'R' ? ' red' : c.party == 'D' ? ' blue' : ''))
        .text(c => `${c.first_name} ${c.last_name} (${c.party})`)

      content.append('div')
        .attr('class', 'status')
        .text(c => c.status === 'I' ? 'Incumbent' : 'Challenger')

      candidate.append('div')
        .attr('class', 'datapoint')

      const sortDisplay = {
        finance: c => c.receipts > 1000000 ? 
            numeral(c.receipts).format('$0.00a') :
            numeral(c.receipts).format('$0a'),
        attention: c => numeral(c.news_hits).format('0a')
      }

      const sortFn = {
        finance: (a, b) => d3.descending(a.receipts, b.receipts),
        attention: (a, b) => d3.descending(a.news_hits, b.news_hits)
      }

      // Update items
      function updateSort() {
        const tab = $('.interactive-detail .secondary.menu .active').data('tab');
        console.log('sorting list', list);
        list
          .sort(sortFn[tab])
          .selectAll('.datapoint')
          .text(sortDisplay[tab])
      }
      
      updateSort();
      
      // Remove items
      list.exit().remove();

      $('.interactive-container').attr('style', 'height: '+($('.interactive-detail').height() + 50)+'px');
      $('.interactive-detail .loader').hide();
      $('.interactive-detail .menu.secondary .item')
        .on('click', e => {
          $('.interactive-detail .menu.secondary .active').removeClass('active');
          $(e.target).addClass('active');
          updateSort()
        });
    });
  }

  this.hideRace = function hideRace() {
    $('.interactive-container').attr('style', '');
    $(".interactive-sidebar").removeClass('show-detail');
    $('.interactive-map .active').removeClass('active');
    $('.interactive-detail .menu.secondary .item').off('click');
  }

  this.filterState = function filterState(state) {
    console.log(state);
  }
}

$(document).ready(() => {
  const map = new ElectionMap('#electionmap');

  $('.interactive-list .menu .item').tab();
});