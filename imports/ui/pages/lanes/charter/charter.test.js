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
  ROOT_COLOR,
  FAIL_COLOR,
  ACTIVE_COLOR,
  SUCCESS_COLOR,
  handle_download_yaml,
  svg_graph,
  dragged,
  dragstarted,
  dragended,
  clamp,
  click,
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
const shipments_find_none = () => ({});
const call_method = H.call;

describe('Charter Page', () => {
  before(() => {
    Shipments.findOne = test_shipments_find_one;
  });
  after(() => {
    Shipments.findOne = shipments_find_one;
  });

  describe('#assign_followup', () => {
    const target = {
      slug: 'target_slug',
      recursive: false,
      children: [],
    };
    const recursive = {
      slug: 'target_slug',
      children: [],
    };
    const success_followup = {
      slug: 'success_followup_slug',
      name: 'Followup',
      last_shipment: { exit_code: 0 },
    };
    const fail_followup = {
      slug: 'fail_followup_slug',
      name: 'Followup',
      last_shipment: { exit_code: 1 },
    };
    const active_followup = {
      slug: 'active_followup_slug',
      name: 'Followup',
      last_shipment: { active: true },
    };
    const parent_slug = 'parent_slug';
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
        success_followup, target, parent_slug, nodes, links
      );
      assign_followup(fail_followup, target, parent_slug, nodes, links);
      assign_followup(active_followup, target, parent_slug, nodes, links);
      success_followup_node = nodes.find(
        (node) => node.id === 'success_followup_slug'
      );
      fail_followup_node = nodes.find(
        (node) => node.id === 'fail_followup_slug'
      );
      followup_link = links.find(
        (link) => link.id === 'target_slug:success_followup_slug'
      );
    });

    it('assigns graph role, parent, and recursion', () => {
      expect(success_followup.role).to.equal(FOLLOWUP);
      expect(success_followup.parent).to.equal('target_slug');
      expect(success_followup.recursive).to.equal(false);
      expect(active_followup.parent).to.eq('target_slug');
      assign_followup(recursive, recursive, parent_slug, [], []);
      expect(recursive.recursive).to.eq(true);
    });
    it('adds the followup lane to the targets of the graph', () => {
      expect(target.children).to.deep.equal([
        success_followup,
        fail_followup,
        active_followup,
      ]);
    });
    it('adds a decorated node to the nodes list if it does not exist', () => {
      expect(success_followup_node.name).to.equal('Followup');
      expect(success_followup_node.cssClass).to.equal('success_followup_slug');
      expect(success_followup_node.color).to.eq(SUCCESS_COLOR);
      expect(fail_followup_node.color).to.eq(FAIL_COLOR);
    });
    it('adds a decorated link to the links list', () => {
      expect(followup_link.sid).to.equal('target_slug');
      expect(followup_link.tid).to.equal('success_followup_slug');
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
    let parent_slug;
    let plan;
    let failed_plan;
    let active_plan;
    const recursive = { slug: 'target_slug', children: [] };

    beforeEach(() => {
      nodes = [];
      links = [];
      target = { slug: 'target_slug', recursive: false, children: [] };
      parent_slug = 'parent_slug';
      plan = {
        slug: 'success_plan_slug',
        name: 'Plan Name',
        last_shipment: { exit_code: 0 },
      };
      failed_plan = {
        slug: 'failed_plan_slug',
        name: 'Failed Plan',
        last_shipment: { exit_code: 1 },
      };
      active_plan = {
        slug: 'active_plan_slug',
        name: 'Active Plan',
        last_shipment: { active: true },
      };
    });

    it('assigns graph role, parent, and recursion', () => {
      assign_salvage(plan, target, parent_slug, nodes, links);
      assign_salvage(active_plan, target, parent_slug, nodes, links);
      expect(plan.role).to.eq(SALVAGE);
      expect(plan.parent).to.eq(target.slug);
      expect(plan.recursive).to.eq(false);
      expect(active_plan.parent).to.eq(target.slug);
      assign_salvage(recursive, recursive, parent_slug, [], []);
      expect(recursive.recursive).to.eq(true);
    });
    it('adds the salvage plan lane to the targets of the graph', () => {
      assign_salvage(plan, target, parent_slug, nodes, links);
      expect(target.children.length).to.eq(1);
      expect(target.children[0]).to.eq(plan);
    });
    it('adds a decorated node to the nodes list if it does not exist', () => {
      assign_salvage(plan, target, parent_slug, nodes, links);
      assign_salvage(failed_plan, target, parent_slug, nodes, links);
      expect(nodes.length).to.eq(2);
      expect(nodes[0].name).to.eq(plan.name);
      expect(nodes[0].cssClass).to.eq(plan.slug);
      expect(nodes[0].color).to.eq(SUCCESS_COLOR);
      expect(nodes[1].color).to.eq(FAIL_COLOR);
    });
    it('adds a decorated link to the links list', () => {
      assign_salvage(plan, target, parent_slug, nodes, links);
      expect(links.length).to.eq(1);
      expect(links[0].id).to.eq(`${target.slug}:${plan.slug}`);
      expect(links[0].name).to.eq(SALVAGE);
    });
    it('returns true if successful, false otherwise', () => {
      expect(assign_salvage(plan, target, parent_slug, nodes, links))
        .to.eq(true);
      expect(assign_salvage()).to.eq(false);
    });
  });

  describe('#assign_children', () => {
    const rootNode = { slug: 'root' };
    const target = {
      slug: 'target',
      followup: { slug: 'followup' },
      salvage_plan: { slug: 'salvage' },
      children: [],
    };
    const nodes = [];
    const links = [];
    let result;
    const test_lanes_find_one = function (query) {
      const { slug } = query;
      switch (slug) {
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
      result = assign_children(target, rootNode.slug, nodes, links);
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
    it('returns the lane if it and its downstreams are already added', () => {
      expect(assign_children(target, rootNode.slug, ['followup'], []).slug)
        .to.eq('target');
    });
  });

  describe('#build_graph', () => {
    beforeEach(() => {
      resetDatabase(null);
      node_list.set(undefined);
      link_list.set(undefined);
      root_node.set(undefined);
      H.Session.set('lane', { slug: 'test_lane', name: 'test' });
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
      expect(root_node.get().color).to.eq(ROOT_COLOR);
      H.Session.set('lane', {
        slug: 'test_lane',
        name: 'test',
        last_shipment: { exit_code: 0 },
      });
      build_graph();
      expect(root_node.get().color).to.eq(SUCCESS_COLOR);
      H.Session.set('lane', {
        slug: 'test_lane',
        name: 'test',
        last_shipment: { exit_code: 1 },
      });
      build_graph();
      expect(root_node.get().color).to.eq(FAIL_COLOR);
      H.Session.set('lane', {
        slug: 'test_lane',
        name: 'test',
        last_shipment: { active: true },
      });
      build_graph();
      expect(root_node.get().color).to.eq(ACTIVE_COLOR);
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
        H.Session.set('lane', { slug: 'test_lane', name: 'test' });
        expect(lane()).to.eq(H.Session.get('lane'));
        H.Session.set('lane', undefined);
        expect(_.isEmpty(lane())).to.eq(true);
      });
  });

  describe('#graph_options', () => {
    it('returns the configured graph options', () => {
      const window = H.window;
      const options = graph_options();
      delete H.window;
      const windowless_options = graph_options();
      expect(typeof options).to.eq('object');
      expect(typeof options.size).to.eq('object');
      expect(options.size.h).to.eq(1775);
      expect(windowless_options.size.h).to.eq(0);
      H.window = window;
    });
  });

  describe('#handle_link_click', () => {
    it('navigates to a shipment or charter, and returns the url path', () => {
      this.$route = { path: 'foo' };
      this.$router = [];

      let handle1 = handle_link_click({}, {
        target: {
          lane: {
            last_shipment: { start: 'bar' },
            slug: 'baz',
          },
        },
      });
      let handle2 = handle_link_click({}, {
        lane: {
          last_shipment: { start: 'bar' },
          slug: 'baz',
        },
      });
      let expected_url = '/lanes/baz/ship/bar';
      expect(this.$router.length).to.eq(2);
      expect(this.$router[0]).to.eq(expected_url);
      expect(handle1).to.eq(expected_url);
      expect(handle2).to.eq(expected_url);

      let handle3 = handle_link_click({}, {
        target: {
          lane: { slug: 'qux' },
        },
      });
      expected_url = '/lanes/qux/charter';
      expect(handle3).to.eq(expected_url);
    });
  });

  describe('#handle_download_yaml', () => {
    it('triggers a download from ther server', () => {
      // eslint-disable-next-line no-native-reassign
      document = {
        createElement: () => ({
          setAttribute: () => {},
          addEventListener: (event, callback) => {
            cb = callback.bind(this);
          },
          click: () => {},
        }),
      };
      let called_method;
      let called_slug;
      this.$route = { params: { slug: 'test' } };
      H.call = (method, slug, callback) => {
        called_method = method;
        called_slug = slug;
        callback(null, 'test');
      };
      handle_download_yaml.bind(this)();
      expect(called_method).to.eq('Lanes#download_charter_yaml');
      expect(called_slug).to.eq('test');
      H.call = (method, slug, callback) => callback(true);
      expect(handle_download_yaml).to.throw();
      // eslint-disable-next-line no-native-reassign
      document = null;
      H.call = call_method;
      delete this.$route;
    });
  });

  describe('#svg_graph', () => {
    beforeEach(() => {
      resetDatabase(null);
      // eslint-disable-next-line no-native-reassign
      document = {
        querySelector: () => {},
        createElement: () => ({
          setAttribute: () => {},
          addEventListener: (event, callback) => {
            cb = callback.bind(this);
          },
          click: () => {},
        }),
      };
    });

    it('should set any prior svg contents to an empty string', () => {
      svg_graph();
      expect(H.html_calls['.charter svg']).to.eq('');
    });
    it('should return an empty string', () => {
      expect(svg_graph()).to.eq('');
    });
  });

  describe('#dragged', () => {
    const event = { x: 100, y: 2000 };
    const width = 1024;
    const height = 768;
    const d = {};
    const simulation = {
      alpha: () => ({ restart: () => { called = true; } }),
    };
    let called = false;
    it('should assign clamped coords to the data node passed to it', () => {
      dragged(event, d, width, height, simulation);
      expect(d.fx).to.eq(100);
      expect(d.fy).to.eq(height);
      expect(called).to.eq(true);
    });
  });

  describe('#dragstarted', () => {
    const event = {
      active: true,
      subject: { x: 100, y: 250 },
      sourceEvent: { target: { parentElement: '' } },
    };
    let classed_called = false;
    let restart_called = false;
    const d3 = {
      select: () => ({ classed: () => { classed_called = true; } }),
    };
    const simulation = {
      alphaTarget: () => ({ restart: () => { restart_called = true; } }),
    };
    it('should assign fixed coords for its current position', () => {
      dragstarted(event, simulation, d3);
      expect(event.subject.fx).to.eq(event.subject.x);
      expect(event.subject.fy).to.eq(event.subject.y);
    });
    it('should add the "fixed" class to the calling element', () => {
      classed_called = false;
      dragstarted(event, simulation, d3);
      expect(classed_called).to.eq(true);
    });
    it('should restart the simulation if not actively moving', () => {
      restart_called = false;
      event.active = false;
      dragstarted(event, simulation, d3);
      expect(restart_called).to.eq(true);
    });
  });

  describe('#dragended', () => {
    const event = { active: false };
    called = false;
    const simulation = { alphaTarget: () => { called = true; } };
    it('stops the simulation when no longer actively being moved', () => {
      dragended(event, simulation);
      expect(called).to.eq(true);
    });
  });

  describe('#clamp', () => {
    it('should clamp a number passed to within the bounds passed', () => {
      expect(clamp(1, 2, 3)).to.eq(2);
      expect(clamp(4, 2, 3)).to.eq(3);
      expect(clamp(2, 1, 3)).to.eq(2);
    });
  });

  describe('#click', () => {
    const event = { target: { parentElement: '' } };
    let classed_called;
    let restart_called;
    const d3 = {
      select: () => ({ classed: () => { classed_called = true; } }),
    };
    const simulation = {
      alpha: () => ({ restart: () => { restart_called = true; } }),
    };
    const d = { fx: 100, fy: 200 };
    it('should remove any fixed coords', () => {
      click(event, d, simulation, d3);
      expect(d.fx).to.eq(undefined);
      expect(d.fy).to.eq(undefined);
    });
    it('should remove the "fixed" class from the calling element', () => {
      classed_called = false;
      click(event, d, simulation, d3);
      expect(classed_called).to.eq(true);
    });
    it('should restart the simulation', () => {
      restart_called = false;
      click(event, d, simulation, d3);
      expect(restart_called).to.eq(true);
    });
  });
});
