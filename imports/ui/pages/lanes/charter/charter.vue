<template>
  <div id=charter-page>
    <h1 class="text-5xl my-2">Lane Charter</h1>
    <figure v-if="this.$subReady.Lanes && lane.name" class="charter">
      <figcaption class="text-2xl">
        Starting with lane:
        <a class="root" :href="'/lanes/' + lane.slug + '/ship'">{{
          lane.name
        }}</a>
      </figcaption>
      <svg></svg>
    </figure>
    <h2 v-else-if="$subReady.Lanes && !lane.name">
      Lane with slug <code>{{$route.params.slug}}</code> isn't configured.
    </h2>
    <h2 v-else>Loading...</h2>
    <div v-if="build_graph().length">{{svg_graph}}</div>
  </div>
</template>

<script>
import * as d3 from 'd3';
import {
  build_graph,
  node_list,
  link_list,
  lane,
  graph_options,
  handle_link_click,
} from './lib';
import './charter.css';

const options = {
  sort: { actual: -1 },
  limit: 1,
};

const svg_graph = function svg_graph () {
  build_graph.bind(this)();
  const width = H.$('.charter').width();
  const height = H.$('.charter').height();

  const simulation = d3.forceSimulation(node_list.get())
    .force("link", d3.forceLink(link_list.get()).distance(250).id(d => d.id))
    .force("charge", d3.forceManyBody())
    .force("center", d3.forceCenter(width / 2, height / 2))
    .on("tick", ticked);

  const svg = d3.select('svg')
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto;");

  const link = svg.append("g")
    .selectAll('.link')
    .data(link_list.get())
    .join("g")
    .attr('class', 'link');
  
  const link_line = link.append("path")
    .attr(
      'd', d => {
        const x1 = (d.source.x) || '0';
        const y1 = (d.source.y) || '0';
        const x2 = (d.target.x) || '0';
        const y2 = (d.target.y) || '0';
        return `M ${x1} ${y1} L ${x2} ${y2}`;
      }
    )
    .attr('id', d => d.id)
    .attr('stroke-width', 25)
    .attr('stroke', d => d.color)
    .on('click', handle_link_click.bind(this))
    ;

  const link_text = link.append('text')
    .attr('class', 'link-label')
    .append('textPath')
    .style('fill', '#fff')
    .style('font-size', '14px')
    .text(d => d.name)
    .attr('startOffset', '33%')
    .attr('xlink:href', d => `#${d.id}`);

  const node = svg.append("g")
    .selectAll('.node')
    .data(node_list.get())
    .join("g")
    .attr('class', 'node');
  
  node.append('circle')
    .attr("r", 25)
    .attr("fill", d => d.color)
    .attr('stroke', d => d.stroke)
    .attr("stroke-width", d => d.stroke_width);

  node.append("title").text(d => d.name);

  node.append('text')
    .text(d => d.name)
    .attr('x', 30)
    .attr('y', 7)
    .style('fill', '#fff')
    .style('font-size', '16px')
    .on('click', handle_link_click.bind(this))
    ;

  node.call(d3.drag()
    .on("start", dragstarted)
    .on("drag", dragged)
    .on("end", dragended))
    .on('click', click);

  function ticked() {
    link_text.attr('transform', d => {
      const x = (d.source.x + d.target.x) / 2;
      const y = (d.source.y + d.target.y) / 2;
      return `translate(${x}, ${y})`;
    });
    link_line.attr(
      'd', d => {
        const x1 = (d.source.x) || '0';
        const y1 = (d.source.y) || '0';
        const x2 = (d.target.x) || '0';
        const y2 = (d.target.y) || '0';
        return `M ${x1} ${y1} L ${x2} ${y2}`;
      }
    );

    node.attr('transform', d => `translate(${d.x}, ${d.y})`);
  }

  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
    d3.select(this).classed('fixed', true);
  }

  function dragged(event, d) {
    d.fx = clamp(event.x, 0, width);
    d.fy = clamp(event.y, 0, height);
    simulation.alpha(1).restart();
  }

  function clamp (x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }

  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
  }

  function click (event, d) {
    delete d.fx;
    delete d.fy;
    d3.select(this).classed('fixed', false);
    simulation.alpha(1).restart();
  }

  return '';
}

export default {
  meteor: {
    $subscribe: {
      Lanes: [],

      Shipments: function () {
        let list = node_list.get()?.map((node) => node.id);
        return [list, options];
      },
    },
    lane,
    svg_graph,
  },

  methods: {
    build_graph,
  }
};
</script>