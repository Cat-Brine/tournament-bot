const d3 = require('d3');
const jsdom = require('jsdom');
const svg2png = require('svg2png');

const printPNG = function (data, callback) {
  const margin = {top: 30, right: 10, bottom: 10, left: 10};
  const width = 600 - margin.left - margin.right;
  const halfWidth = width / 2;
  const height = 250 - margin.top - margin.bottom;
  let i = 0;
  const duration = 500;
  let root = undefined;

  const getChildren = function(d) {
    var a = [];
    if (d.winners) for (var i = 0; i < d.winners.length; i++) {
      d.winners[i].isRight = false;
      d.winners[i].parent = d;
      a.push(d.winners[i]);
    } if (d.challengers) for 
    (var i = 0; i < d.challengers.length; i++){
      d.challengers[i].isRight = true;
      d.challengers[i].parent = d;
      a.push(d.challengers[i]);
    }
    return a.length?a:null;
  }
  const elbow = function (d){
    var source = calcLeft(d.source);
    var target = calcLeft(d.target);
    var hy = (target.y-source.y)/2;
    if(d.isRight) hy = -hy;
    return 'M' + source.y + ',' + source.x
    + 'H' + (source.y+hy)
    + 'V' + target.x + 'H' + target.y;
  };
  const connector = elbow;

  const calcLeft = function(d){

    var l = d.y;
    if(!d.isRight){
      l = d.y-halfWidth;
      l = halfWidth - l;
    }
    return {'x' : d.x, 'y' : l};
  };
  let png;


  jsdom.env({
    html:'',
    features:{ QuerySelector:true },
    done: function(errors, window) {
      window.d3 = d3.select(window.document);
      const tree = d3.layout.tree()
      .size([height, width]);

      const diagonal = d3.svg.diagonal()
      .projection(function(d) { return [d.y, d.x]; });


      const svg = window.d3.select('body')
      .append('div').attr('class','container')
      .append('svg')
      .attr('width', width + margin.right + margin.left)
      .attr('height', height + margin.top + margin.bottom)
      .attr({
        xmlns:'http://www.w3.org/2000/svg',
      })
      .append('g')
      .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      root = data;
      root.x0 = height / 2;
      root.y0 = width / 2;

      var t1 = d3.layout.tree().size([height, halfWidth]).children(function(d){return d.winners;}),
      t2 = d3.layout.tree().size([height, halfWidth]).children(function(d){return d.challengers;});
      t1.nodes(root);
      t2.nodes(root);

      var rebuildChildren = function(node){
        node.children = getChildren(node);
        if(node.children) node.children.forEach(rebuildChildren);
      }

      rebuildChildren(root);
      root.isRight = false;
      update(root);

      function toArray(item, arr) {
        arr = arr || [];
        var i = 0, l = item.children?item.children.length:0;
        arr.push(item);
        for(; i < l; i++){
          toArray(item.children[i], arr);
        }
        return arr;
      };

      function update(source) {
        // Compute the new tree layout.
        var nodes = toArray(source);

        // Normalize for fixed-depth.
        nodes.forEach(function(d) { d.y = d.depth * 180 + halfWidth; });

        // Update the nodes…
        var node = svg.selectAll('g')
        .data(nodes, function(d) { return d.id || (d.id = ++i); });

        // Enter any new nodes at the parent's previous position.
        var nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr('transform', function(d) {
          if (d.parent) {
            const p = calcLeft(d);
            return 'translate(' + p.y + ',' + p.x + ')';
          } else return 'translate(' + source.y0 + ',' + source.x0 + ')';
        })

        nodeEnter.append('circle')
        .attr('style', 'cursor: pointer;fill: #fff;stroke: steelblue;stroke-width: 1.5px;')
        .attr('r', 5)
        .style('fill', function(d) { return d._children ? 'lightsteelblue' : '#fff'; });

        nodeEnter.append('text')
        .attr('dy', function(d) { return d.isRight?14:-8;})
        .attr('text-anchor', 'middle')
        .attr('style', 'font: 10px sans-serif;')
        .text(function(d) { return d.name; })
        .style('fill-opacity', 1);

        var link = svg.selectAll('path.link')
        .data(tree.links(nodes), function(d) { return d.target.id; });
        // Enter any new links at the parent's previous position.
        link.enter().insert('svg:path', 'g')
        .attr('style', 'fill: none;stroke: #ccc;stroke-width: 1.5px;')
        .attr('d', function(d) {
          var t = {x: d.target.x, y: d.target.y};
          var o = {x: d.target.parent.x, y: d.target.parent.y};
          return connector({source: o, target: t});
        });
      }

      svg2png(window.d3.select('.container').html())
      .then(buffer => {
        callback(buffer);
      })
    }
  });
};

module.exports = printPNG;
