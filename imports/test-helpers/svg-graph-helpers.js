/**
 * Test helper functions for SVG graph functionality
 *
 * These functions are only used in test environments to set up
 * test infrastructure for d3 force simulations.
 */

import * as d3 from 'd3';

/**
 * Creates a test simulation and assigns it to H.simulation
 * Used when testing SVG graph functions that return early
 * (e.g., when width/height are falsy or nodes are empty)
 *
 * @param {number} x - X coordinate for forceX
 * @param {number} y - Y coordinate for forceY
 * @param {Object} H - Global H namespace object
 */
export const createTestSimulation = function (x, y, H) {
  H.simulation = d3.forceSimulation([])
    .force("link", d3.forceLink([]).distance(50).id(d => d.id))
    .force("charge", d3.forceManyBody().strength(-100))
    .force("x", d3.forceX(x))
    .force("y", d3.forceY(y))
    .on("tick", () => {});
};

