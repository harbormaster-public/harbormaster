import {
  assign_followup,
  assign_salvage,
  assign_children,
  build_graph,
  lane,
  graph_options,
  handle_link_click,
  node_list,
  link_list,
  root_node,
  ROOT,
  FOLLOWUP,
  SALVAGE,
  SUCCESS_COLOR,
  FAIL_COLOR,
  FOLLOWUP_COLOR,
  SALVAGE_COLOR,
  ROOT_COLOR,
  STROKE_WIDTH,
} from './lib';
import { Shipments } from "../../../../api/shipments";
import { Lanes } from "../../../../api/lanes";
import chai from 'chai';
import _ from 'lodash';
import { resetDatabase } from 'cleaner';

const { expect } = chai;
const test_shipments_find_one = function (options) {
  switch (options.lane) {
    case 'success_plan_id':
    case 'success_followup_id':
      return { exit_code: 0 };
    case 'fail_plan_id':
    case 'fail_followup_id':
      return { exit_code: 1 };
    default:
      return undefined;
  }
};
const shipments_find_one = Shipments.findOne;
const shipments_find_one_success = () => ({ exit_code: 0 });
const shipments_find_one_failure = () => ({ exit_code: 1 });
const shipments_find_none = () => ({});

describe('Charter Page', () => {
  before(() => {
    Shipments.findOne = test_shipments_find_one;
  });
  after(() => {
    Shipments.findOne = shipments_find_one;
  });

  describe('#assign_followup', () => {
    const target = {
      _id: 'target_id',
      recursive: false,
      children: [],
    };
    const success_followup = {
      _id: 'success_followup_id',
      name: 'Followup',
    };
    const fail_followup = {
      _id: 'fail_followup_id',
      name: 'Followup',
    };
    const parent_id = 'parent_id';
    const nodes = [
      {
        id: 'node_id',
        name: 'Node',
        _color: '#FFFFFF',
        _cssClass: 'node_id',
        _svgAttrs: {
          stroke: '#FFFFFF',
          'stroke-width': 1,
        },
      },
    ];
    const links = [];
    let success_followup_node;
    let fail_followup_node;
    let followup_link;
    let success;

    before(() => {
      success = assign_followup(
        success_followup, target, parent_id, nodes, links
      );
      assign_followup(fail_followup, target, parent_id, nodes, links);
      success_followup_node = nodes.find(
        (node) => node.id === 'success_followup_id'
      );
      fail_followup_node = nodes.find(
        (node) => node.id === 'fail_followup_id'
      );
      followup_link = links.find(
        (link) => link.id === 'target_id:success_followup_id'
      );
    });

    it('assigns a success color for exit code 0', function () {
      expect(success_followup_node._color).to.equal(SUCCESS_COLOR);
      expect(success_followup_node.shipment).to.deep.equal({ exit_code: 0 });
    });
    it('assigns a fail color for exit code non-0', () => {
      expect(fail_followup_node._color).to.equal(FAIL_COLOR);
      expect(fail_followup_node.shipment).to.deep.equal({ exit_code: 1 });
    });
    it('assigns graph role, parent, and recursion', () => {
      expect(success_followup.role).to.equal(FOLLOWUP);
      expect(success_followup.parent).to.equal('target_id');
      expect(success_followup.recursive).to.equal(false);
    });
    it('adds the followup lane to the targets of the graph', () => {
      expect(target.children).to.deep.equal([success_followup, fail_followup]);
    });
    it('adds a decorated node to the nodes list if it does not exist', () => {
      expect(success_followup_node.name).to.equal('Followup');
      expect(success_followup_node._cssClass).to.equal('success_followup_id');
      expect(success_followup_node._svgAttrs).to.deep.equal({
        stroke: FOLLOWUP_COLOR,
        'stroke-width': STROKE_WIDTH,
      });
    });
    it('adds a decorated link to the links list', () => {
      expect(followup_link.sid).to.equal('target_id');
      expect(followup_link.tid).to.equal('success_followup_id');
      expect(followup_link._color).to.equal(FOLLOWUP_COLOR);
      expect(followup_link.name).to.equal(FOLLOWUP);
    });
    it('returns true if successful, false otherwise', () => {
      expect(success).to.equal(true);
      expect(assign_followup()).to.equal(false);
    });
  });

  describe('#assign_salvage', () => {
    let nodes;
    let links;
    let target;
    let parent_id;
    let plan;

    beforeEach(() => {
      nodes = [];
      links = [];
      target = { _id: 'target_id', recursive: false, children: [] };
      parent_id = 'parent_id';
      plan = { _id: 'success_plan_id', name: 'Plan Name' };
    });

    it('assigns a success color based on exit code 0', () => {
      assign_salvage(plan, target, parent_id, nodes, links);
      expect(nodes.length).to.eq(1);
      expect(nodes[0]._color).to.eq(SUCCESS_COLOR);
    });
    it('assigns graph role, parent, and recursion', () => {
      assign_salvage(plan, target, parent_id, nodes, links);
      expect(plan.role).to.eq(SALVAGE);
      expect(plan.parent).to.eq(target._id);
      expect(plan.recursive).to.eq(false);
    });
    it('adds the salvage plan lane to the targets of the graph', () => {
      assign_salvage(plan, target, parent_id, nodes, links);
      expect(target.children.length).to.eq(1);
      expect(target.children[0]).to.eq(plan);
    });
    it('adds a decorated node to the nodes list if it does not exist', () => {
      assign_salvage(plan, target, parent_id, nodes, links);
      expect(nodes.length).to.eq(1);
      expect(nodes[0].name).to.eq(plan.name);
      expect(nodes[0]._color).to.eq(SUCCESS_COLOR); // Default is successful
      expect(nodes[0]._cssClass).to.eq(plan._id);
      expect(nodes[0]._svgAttrs).to.deep.equal({
        stroke: SALVAGE_COLOR, // But show that it's a salvage plan here
        "stroke-width": STROKE_WIDTH,
      });
    });
    it('adds a decorated link to the links list', () => {
      assign_salvage(plan, target, parent_id, nodes, links);
      expect(links.length).to.eq(1);
      expect(links[0].id).to.eq(`${target._id}:${plan._id}`);
      expect(links[0]._color).to.eq(SALVAGE_COLOR);
      expect(links[0].name).to.eq(SALVAGE);
    });
    it('returns true if successful, false otherwise', () => {
      expect(assign_salvage(plan, target, parent_id, nodes, links)).to.eq(true);
      expect(assign_salvage()).to.eq(false);
    });
  });

  describe('#assign_children', () => {
    const rootNode = { _id: 'root' };
    const target = {
      _id: 'target',
      followup: { _id: 'followup' },
      salvage_plan: { _id: 'salvage' },
      children: [],
    };
    const nodes = [];
    const links = [];
    let result;
    const test_lanes_find_one = function (id) {
      switch (id) {
        case 'followup':
          return target.followup;
        case 'salvage':
          return target.salvage_plan;
        default:
          return undefined;
      }
    };
    const lanes_find_one = Lanes.findOne;

    before(() => {
      Lanes.findOne = test_lanes_find_one;
      result = assign_children(target, rootNode._id, nodes, links);
    });
    after(() => {
      Lanes.findOne = lanes_find_one;
    });

    it('assigns all the downstreams of the root node', () => {
      expect(nodes.length).to.eq(2);
      expect(links.length).to.eq(2);
    });
    it('returns a list of targets with their own children', () => {
      expect(result).to.eq(target);
      expect(result.children.length).to.eq(2);
      expect(result.children[0]).to.deep.eq(target.followup);
    });
  });

  describe('#build_graph', () => {

    beforeEach(() => {
      node_list.set(undefined);
      link_list.set(undefined);
      root_node.set(undefined);
      H.Session.set('lane', { _id: 'test_lane', name: 'test' });
    });

    it('returns false with an invalid lane slug', () => {
      H.Session.set('lane', undefined);
      const invalid_slug = '';
      this.$route = { params: { slug: invalid_slug } };
      expect(build_graph()).to.eq(false);
    });
    it('decorates the lane with role and children', () => {
      const $lane = H.Session.get('lane');
      build_graph();
      expect($lane.role).to.eq(ROOT);
      expect($lane.children.length).to.eq(0);
    });
    it('assigns a color based on exit code', () => {
      Shipments.findOne = shipments_find_none;
      build_graph();
      expect(root_node.get()._color).to.eq(ROOT_COLOR);

      Shipments.findOne = shipments_find_one_success;
      build_graph();
      expect(root_node.get()._color).to.eq(SUCCESS_COLOR);

      Shipments.findOne = shipments_find_one_failure;
      build_graph();
      expect(root_node.get()._color).to.eq(FAIL_COLOR);

      Shipments.findOne = shipments_find_one;
    });
    it('adds the root node to the nodes list', () => {
      build_graph();
      expect(node_list.get().includes(root_node.get())).to.eq(true);
    });
    it('adds the initial empty list to the links list', () => {
      build_graph();
      expect(link_list.get().length).to.eq(0);
    });
    it('returns the nodes list', () => {
      expect(build_graph()).to.eq(node_list.get());
    });
  });

  describe('#lane', () => {
    before(() => {
      resetDatabase(null);
      H.Session.set('lane', undefined);
    });
    it(
      'returns the active lane based on slug or Session, or an empty object',
      () => {
        this.$route = { params: { slug: 'test' } };
        H.Session.set('lane', { _id: 'test_lane', name: 'test' });
        expect(lane()).to.eq(H.Session.get('lane'));
        H.Session.set('lane', undefined);
        expect(_.isEmpty(lane())).to.eq(true);
      });
  });

  describe('#graph_options', () => {
    it('returns the configured graph options', () => {
      expect(typeof graph_options()).to.eq('object');
    });
  });

  describe('#handle_link_click', () => {
    it('navigates to a shipment or charter, and returns the url path', () => {
      this.$route = { path: 'foo' };
      this.$router = [];

      let handle = handle_link_click({}, {
        target: {
          lane: {
            shipment: { start: 'bar' },
            slug: 'baz',
          },
        },
      });
      let expected_url = '/lanes/baz/ship/bar';
      expect(this.$router.length).to.eq(1);
      expect(this.$router[0]).to.eq(expected_url);
      expect(handle).to.eq(expected_url);

      handle = handle_link_click({}, { target: { lane: { slug: 'qux' } } });
      expected_url = '/lanes/qux/charter';
      expect(handle).to.eq(expected_url);
    });
  });
});
