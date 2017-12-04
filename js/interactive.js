function ElectionMap(element) {
  const self = this;

  var centered = null;

  const width = $(element).width() + 30,
        height = width / 1.5;

  $(element).find(".zoom-out")
    .on("click", e => self.toggleZoom(null));

  const projection = d3.geo.albersUsa()
    .scale(1070)
    .translate([width / 2, height / 2]);
  
  const path = d3.geo.path()
    .projection(projection);

  const svg = d3.select(element).append("svg")
    .attr("width", width)
    .attr("height", height);

  svg.append("rect")
    .attr("class", "background")
    .attr("width", width)
    .attr("height", height)
    .on("click", self.toggleZoom);

  const g = svg.append("g");

  d3.json("/server/geodata/us.json", function(error, us) {
    if (error) throw error;

    // Draw districts
    g.append("g")
      .attr("id", "districts")
      .selectAll("path")
        .data(topojson.feature(us, us.objects.districts).features)
      .enter().append("path")
        .attr("d", path)
        .attr("class", "district")
        .on("click", self.districtClick);

    // Draw states
    g.append("g")
      .attr("id", "states")
      .selectAll("path")
        .data(topojson.feature(us, us.objects.states).features)
      .enter().append("path")
        .attr("d", path)
        .attr("class", "state")
        .on("click", self.toggleZoom);

    // Draw paths around states
    g.append("path")
        .datum(topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; }))
        .attr("id", "state-borders")
        .attr("d", path);

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
      .classed("zoomed", centered);

    g.selectAll(".state")
      .classed("active", centered && (d => d === centered))

    g.transition()
      .duration(750)
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
      .style("stroke-width", 1.5 / k + "px");  
  }

  this.districtClick = function districtClick(d) {
    console.log(d);
  }
}

$(document).ready(() => {
  const map = new ElectionMap('#electionmap');

  $('.interactive-list .menu .item').tab();
});