// import {
//   assign_followup,
//   assign_salvage,
//   assign_children,
//   build_graph,
//   lane,
//   graph_options,
//   handle_link_click,
//   node_list,
//   link_list,
// } from './lib';

describe('Charter Page', () => {
  describe('#assign_followup', () => {
    it('assigns a color based on exit code');
    it('assigns graph role, parent, and recursion');
    it('adds the followup lane to the targets of the graph');
    it('adds a decorated node to the nodes list if it does not exist');
    it('adds a decorated link to the links list');
    it('returns true if successful, false otherwise');
  });

  describe('#assign_salvage', () => {
    it('assigns a color based on exit code');
    it('assigns graph role, parent, and recursion');
    it('adds the salvage plan lane to the targets of the graph');
    it('adds a decorated node to the nodes list if it does not exist');
    it('adds a decorated link to the links list');
    it('returns true if successful, false otherwise');
  });

  describe('#assign_children', () => {
    it('assigns all the downstreams of the root node');
    it('returns a list of targets with their own children');
  });

  describe('#build_graph', () => {
    it('returns false with an invalid lane slug');
    it('decorates the lane with role and children');
    it('assigns a color based on exit code');
    it('adds the root node to the nodes list');
    it('adds the initial empty list to the links list');
    it('returns the nodes list');
  });

  describe('#lane', () => {
    it('returns the lane based on slug or an empty object');
  });

  describe('#graph_options', () => {
    it('returns the configured graph options');
  });

  describe('#handle_link_click', () => {
    it('navigates to a new url');
    it('returns the url for the link clicked');
  });
});
