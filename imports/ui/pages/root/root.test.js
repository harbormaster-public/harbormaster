import { expect } from 'chai';
import {
  shipments_last_24_hours,
  latest_shipment,
  total_captains,
  total_harbormasters,
  is_harbormaster,
  is_captain,
  moniker,
  svg_graph,
  collect_graph_lists,
  build_graph,
  node_ids,
} from './lib';
import { resetDatabase } from 'cleaner';
const call_method = H.call;

describe('Root Page (/)', () => {

  describe('#shipments_last_24_hours', function () {
    it('returns the total_shipments in locale string', () => {
      expect(shipments_last_24_hours()).to.eq('Loading');
    });
  });

  describe('#latest_shipment', function () {
    it('returns a loading object if no shipment is available', () => {
      H.call = () => { };
      expect(latest_shipment().locale).to.eq('loading...');
      H.call = call_method;
    });
    it('gets the latest shipment date and saves it in Session', () => {
      H.call = (method) => expect(method).to.eq('Shipments#get_latest_date');
      latest_shipment();
      H.call = call_method;
    });
    it('returns the latest shipment date from Session', () => {
      H.call = () => { };
      H.Session.set('latest_shipment', 'test');
      expect(latest_shipment()).to.eq('test');
      H.call = call_method;
    });
  });

  describe('#total_captains', function () {
    it('returns the total number of captains across all lanes', () => {
      resetDatabase(null);
      expect(total_captains()).to.eq('0');
      Factory.create('lane', { captains: ['test@harbormaster.io'] });
      expect(total_captains()).to.eq('1');
    });
  });

  describe('#total_harbormasters', function () {
    it('returns the total number of current harbormasters', () => {
      resetDatabase(null);
      expect(total_harbormasters()).to.eq('0');
      Factory.create('user', { harbormaster: true });
      expect(total_harbormasters()).to.eq('1');
    });
  });

  describe('#is_harbormaster', function () {
    it('returns true if current the user is a harbormaster', () => {
      resetDatabase(null);
      Factory.create('user', {
        _id: H.user().emails[0].address,
        harbormaster: true,
      });
      expect(is_harbormaster()).to.eq(true);
    });
  });

  describe('#is_captain', function () {
    it('returns true if the user is captain of any lanes', () => {
      resetDatabase(null);
      Factory.create('lane', { captains: [H.user().emails[0].address] });
      expect(is_captain()).to.eq(true);
    });
    it('returns false otherwise', () => {
      resetDatabase(null);
      expect(is_captain()).to.eq(false);
    });
  });

  describe('#moniker', function () {
    it('returns the user role and username', () => {
      Factory.create('user', { _id: 'test@harbormaster.io' });
      expect(moniker()).to.eq('User test@harbormaster.io');
      Factory.create('lane', { captains: ['test@harbormaster.io'] });
      expect(moniker()).to.eq('Captain test@harbormaster.io');
      resetDatabase(null);
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(moniker()).to.eq('Harbormaster test@harbormaster.io');
    });
  });

  describe('#svg_graph', function () {
    it('returns a graph simulation', () => {
      // eslint-disable-next-line no-native-reassign
      document = {
        querySelector () {},
      };
      expect(svg_graph()).to.eq('');
      expect(typeof H.simulation.tick).to.eq('function');
      H.window.render_null = true;
      expect(svg_graph()).to.eq('');
      H.window.render_null = false;
      // eslint-disable-next-line no-native-reassign
      document = null;
    });
  });

  describe('#collect_graph_lists', function () {
    it('returns the collected nodes and links', () => {
      resetDatabase(null);
      let lane1; let lane2; let lane3; let lane4;
      lane4 = {
        _id: 'lane4',
        name: 'lane4',
        last_shipment: false,
        followup: null,
        salvage_plan: null,
      };
      lane3 = {
        _id: 'lane3',
        name: 'lane3',
        followup: null,
        salvage_plan: null,
        last_shipment: { active: true },
      };
      lane2 = {
        _id: 'lane2',
        name: 'lane2',
        followup: null,
        salvage_plan: null,
        last_shipment: { exit_code: 1 },
      };
      lane1 = {
        _id: 'lane1',
        name: 'lane1',
        followup: lane2,
        salvage_plan: lane3,
        last_shipment: { exit_code: 0 },
      };
      Factory.create('lane', lane4);
      Factory.create('lane', lane3);
      Factory.create('lane', lane2);
      Factory.create('lane', lane1);

      expect(node_ids.indexOf(lane1._id)).to.eq(-1);
      collect_graph_lists(lane1);
      const lists = collect_graph_lists(lane4);
      expect(collect_graph_lists()).to.eq(false);
      expect(lists.nodes.length).to.eq(4);
      expect(lists.links.length).to.eq(2);
      expect(lists.nodes[0].fill).to.eq('#44aa99');
      expect(lists.nodes[1].fill).to.eq('#D41159');
      expect(lists.nodes[2].fill).to.eq('darkgoldenrod');
      expect(lists.nodes[3].fill).to.eq(undefined);
      collect_graph_lists(lane1);
      expect(lists.node_ids.indexOf(lane1._id)).to.eq(0);
      expect(lists.node_ids.length).to.eq(4);
    });
  });

  describe('#build_graph', function () {
    it('returns the nodes of the graph', () => {
      resetDatabase(null);
      Factory.create('lane', { _id: 'lane1' });
      Factory.create('lane', { _id: 'lane2' });
      expect(build_graph().length).to.eq(2);
    });
  });
});
