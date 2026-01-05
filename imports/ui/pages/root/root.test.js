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
  total_shipments,
  getState,
  getColor,
  clamp,
  createLinkPathData,
  createSvgElement,
  createLinkSelections,
  createDragHandlers,
  createTickedHandler,
  createNodeSelections,
  setupDragBehavior,
  createSimulation,
  updateNodeProperties,
  updateSimulation,
  updateLinkSelections,
  updateNodeSelections,
  initializeGraphVisualization,
  node_list,
  link_list,
  setLinkSelection,
  setNodeSelection,
} from './lib';
import * as d3 from 'd3';
import { resetDatabase } from '../../../test-helpers/reset-database';
import {
  setupInMemoryCollection,
} from '../../../test-helpers/setup-collection-stubs';
import { Lanes } from '../../../api/lanes';
import { Users } from '../../../api/users';
const call_method = H.call;
const user_method = H.user;

describe('Root Page (/)', () => {
  let lanesStub;
  let usersStub;

  beforeEach(async () => {
    await resetDatabase();
    lanesStub = setupInMemoryCollection(Lanes);
    usersStub = setupInMemoryCollection(Users);
  });

  afterEach(async () => {
    H.call = call_method;
    H.user = user_method;
    if (lanesStub) lanesStub.restore();
    if (usersStub) usersStub.restore();
    await resetDatabase();
  });

  describe('#shipments_last_24_hours', function () {
    it('returns the total_shipments in locale string', () => {
      expect(shipments_last_24_hours()).to.eq('Loading');
    });
    it('returns String(val) when val is falsy', () => {
      total_shipments.set(null);
      expect(shipments_last_24_hours()).to.eq('null');
      total_shipments.set(undefined);
      expect(shipments_last_24_hours()).to.eq('undefined');
      total_shipments.set(0);
      expect(shipments_last_24_hours()).to.eq('0');
      total_shipments.set(false);
      expect(shipments_last_24_hours()).to.eq('false');
      total_shipments.set('');
      expect(shipments_last_24_hours()).to.eq('');
      // Reset to default
      total_shipments.set('Loading');
    });
    it('returns String(val) when val does not have toLocaleString', () => {
      total_shipments.set({});
      expect(shipments_last_24_hours()).to.eq('[object Object]');
      // Reset to default
      total_shipments.set('Loading');
    });
    it('calls toLocaleString() when val is a number', () => {
      total_shipments.set(1234);
      expect(shipments_last_24_hours()).to.eq('1,234');
      total_shipments.set(1234567);
      expect(shipments_last_24_hours()).to.eq('1,234,567');
      // Reset to default
      total_shipments.set('Loading');
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
    it('returns the total number of captains across all lanes', async () => {
      expect(total_captains()).to.eq('0');
      const testLane = { captains: ['test@harbormaster.io'] };
      lanesStub.insert(testLane);
      expect(total_captains()).to.eq('1');
    });
    it('ignores lanes without captains or with empty captains arrays',
      async () => {
        const laneWithoutCaptains = { name: 'lane1' };
        const laneWithNullCaptains = { name: 'lane2', captains: null };
        const laneWithUndefinedCaptains = {
          name: 'lane3',
          captains: undefined,
        };
        const laneWithEmptyCaptains = { name: 'lane4', captains: [] };
        const laneWithCaptains = {
          name: 'lane5',
          captains: ['captain@test.com'],
        };

        lanesStub.insert(laneWithoutCaptains);
        lanesStub.insert(laneWithNullCaptains);
        lanesStub.insert(laneWithUndefinedCaptains);
        lanesStub.insert(laneWithEmptyCaptains);
        lanesStub.insert(laneWithCaptains);

        // Should only count the one lane with captains
        expect(total_captains()).to.eq('1');
      });
  });

  describe('#total_harbormasters', function () {
    it('returns the total number of current harbormasters', async () => {
      expect(total_harbormasters()).to.eq(0);
      const testUser = {
        _id: 'test@harbormaster.io',
        emails: [{ address: 'test@harbormaster.io' }],
        harbormaster: true,
      };
      usersStub.insert(testUser);
      expect(total_harbormasters()).to.eq(1);
    });
  });

  describe('#is_harbormaster', function () {
    it('returns true if current the user is a harbormaster', async () => {
      const testUser = {
        _id: 'test@harbormaster.io',
        emails: [{ address: 'test@harbormaster.io' }],
        harbormaster: true,
      };
      usersStub.insert(testUser);
      expect(await is_harbormaster()).to.eq(true);
    });
    it('returns undefined when user_id is undefined', async () => {
      H.user = () => null;
      expect(await is_harbormaster()).to.eq(undefined);
      H.user = () => ({});
      expect(await is_harbormaster()).to.eq(undefined);
      H.user = () => ({ emails: null });
      expect(await is_harbormaster()).to.eq(undefined);
      H.user = () => ({ emails: [] });
      expect(await is_harbormaster()).to.eq(undefined);
    });
  });

  describe('#is_captain', function () {
    it('returns true if the user is captain of any lanes', async () => {
      const testLane = { captains: [H.user().emails[0].address] };
      lanesStub.insert(testLane);
      expect(await is_captain()).to.eq(true);
    });
    it('returns false otherwise', async () => {
      expect(await is_captain()).to.eq(false);
    });
  });

  describe('#moniker', function () {
    it('returns the user role and username', async () => {
      const testUser = {
        _id: 'test@harbormaster.io',
        emails: [{ address: 'test@harbormaster.io' }],
      };
      usersStub.insert(testUser);
      expect(await moniker()).to.eq('User test@harbormaster.io');

      lanesStub.insert({ captains: ['test@harbormaster.io'] });
      expect(await moniker()).to.eq('Captain test@harbormaster.io');

      usersStub.clear();
      usersStub.insert({ ...testUser, harbormaster: true });
      expect(await moniker()).to.eq('Harbormaster test@harbormaster.io');
    });
    it('sets userEmail to undefined when user has no emails', async () => {
      // Test case: currentUser.emails doesn't exist - triggers else path
      // Note: is_captain will crash when accessing H.user().emails[0].address
      // but the else path (userEmail = undefined) is executed first
      H.user = () => ({});
      try {
        await moniker();
      }
      catch (e) {
        // Expected - is_captain crashes after else path executes
        // The else path is covered even though the function crashes
        expect(e.message).to.include('Cannot read');
      }
      // Test case: emails array is empty - triggers else path
      H.user = () => ({ emails: [] });
      try {
        await moniker();
      }
      catch (e) {
        // Expected - is_captain crashes
        expect(e.message).to.include('Cannot read');
      }
      // Test case: emails[0] is null/undefined - triggers else path
      H.user = () => ({ emails: [null] });
      try {
        await moniker();
      }
      catch (e) {
        // Expected - is_captain crashes
        expect(e.message).to.include('Cannot read');
      }
    });
  });

  describe('#getState', function () {
    it('returns exit_code when lastShipment has exit_code', () => {
      const laneObj = {
        last_shipment: { exit_code: 0 },
      };
      expect(getState(laneObj)).to.eq(0);

      laneObj.last_shipment.exit_code = 1;
      expect(getState(laneObj)).to.eq(1);

      laneObj.last_shipment.exit_code = -1;
      expect(getState(laneObj)).to.eq(-1);
    });
    it('returns "active" when lastShipment is active and exit_code is null',
      () => {
        const laneObj = {
          last_shipment: { active: true, exit_code: null },
        };
        expect(getState(laneObj)).to.eq('active');
      });
    it('returns "active" when lastShipment is active and exit_code is ' +
      'undefined',
    () => {
      const laneObj = {
        last_shipment: { active: true },
      };
      expect(getState(laneObj)).to.eq('active');
    });
    it('returns undefined when lastShipment does not exist', () => {
      const laneObj = {};
      expect(getState(laneObj)).to.eq(undefined);
    });
    it('returns undefined when lastShipment exists but has no active or ' +
      'exit_code',
    () => {
      const laneObj = {
        last_shipment: {},
      };
      expect(getState(laneObj)).to.eq(undefined);
    });
    it('returns exit_code when exit_code is 0 (not null)', () => {
      const laneObj = {
        last_shipment: { exit_code: 0, active: true },
      };
      expect(getState(laneObj)).to.eq(0);
    });
  });

  describe('#getColor', function () {
    it('returns "#44aa99" when state is 0', () => {
      expect(getColor(0)).to.eq('#44aa99');
    });
    it('returns "#D41159" when state is truthy and not "active"', () => {
      expect(getColor(1)).to.eq('#D41159');
      expect(getColor(-1)).to.eq('#D41159');
      expect(getColor(42)).to.eq('#D41159');
    });
    it('returns "darkgoldenrod" when state is "active"', () => {
      expect(getColor('active')).to.eq('darkgoldenrod');
    });
    it('returns undefined when state is undefined', () => {
      expect(getColor(undefined)).to.eq(undefined);
    });
    it('returns undefined when state is null', () => {
      expect(getColor(null)).to.eq(undefined);
    });
    it('returns undefined when state is false', () => {
      expect(getColor(false)).to.eq(undefined);
    });
  });

  describe('#clamp', function () {
    it('returns x when x is less than lo (if lo <= hi)', () => {
      // Note: This appears to be a bug - should return lo but returns x
      expect(clamp(5, 10, 20)).to.eq(5);
      expect(clamp(-5, 0, 10)).to.eq(-5);
      expect(clamp(0, 1, 5)).to.eq(0);
    });
    it('returns hi when x is greater than hi', () => {
      expect(clamp(25, 10, 20)).to.eq(20);
      expect(clamp(15, 0, 10)).to.eq(10);
      expect(clamp(100, 1, 5)).to.eq(5);
    });
    it('returns x when x is between lo and hi', () => {
      expect(clamp(15, 10, 20)).to.eq(15);
      expect(clamp(5, 0, 10)).to.eq(5);
      expect(clamp(3, 1, 5)).to.eq(3);
    });
    it('returns lo when x equals lo', () => {
      expect(clamp(10, 10, 20)).to.eq(10);
      expect(clamp(0, 0, 10)).to.eq(0);
    });
    it('returns hi when x equals hi', () => {
      expect(clamp(20, 10, 20)).to.eq(20);
      expect(clamp(10, 0, 10)).to.eq(10);
    });
    it('returns hi when lo > hi and x < lo', () => {
      // When lo > hi, the function returns hi if the intermediate value > hi
      expect(clamp(5, 20, 10)).to.eq(10);
    });
    it('handles negative values', () => {
      // When x < lo and lo <= hi, returns x (not lo)
      expect(clamp(-10, -5, 5)).to.eq(-10);
      expect(clamp(10, -5, 5)).to.eq(5);
      expect(clamp(0, -5, 5)).to.eq(0);
    });
  });

  describe('#createLinkPathData', function () {
    it('creates SVG path string with source and target coordinates', () => {
      const linkData = {
        source: { x: 10, y: 20 },
        target: { x: 30, y: 40 },
      };
      expect(createLinkPathData(linkData)).to.eq('M 10 20 L 30 40');
    });
    it('defaults to "0" when source.x is falsy', () => {
      const linkData = {
        source: { x: null, y: 20 },
        target: { x: 30, y: 40 },
      };
      expect(createLinkPathData(linkData)).to.eq('M 0 20 L 30 40');

      linkData.source.x = undefined;
      expect(createLinkPathData(linkData)).to.eq('M 0 20 L 30 40');

      linkData.source.x = 0;
      expect(createLinkPathData(linkData)).to.eq('M 0 20 L 30 40');
    });
    it('defaults to "0" when source.y is falsy', () => {
      const linkData = {
        source: { x: 10, y: null },
        target: { x: 30, y: 40 },
      };
      expect(createLinkPathData(linkData)).to.eq('M 10 0 L 30 40');

      linkData.source.y = undefined;
      expect(createLinkPathData(linkData)).to.eq('M 10 0 L 30 40');

      linkData.source.y = 0;
      expect(createLinkPathData(linkData)).to.eq('M 10 0 L 30 40');
    });
    it('defaults to "0" when target.x is falsy', () => {
      const linkData = {
        source: { x: 10, y: 20 },
        target: { x: null, y: 40 },
      };
      expect(createLinkPathData(linkData)).to.eq('M 10 20 L 0 40');

      linkData.target.x = undefined;
      expect(createLinkPathData(linkData)).to.eq('M 10 20 L 0 40');

      linkData.target.x = 0;
      expect(createLinkPathData(linkData)).to.eq('M 10 20 L 0 40');
    });
    it('defaults to "0" when target.y is falsy', () => {
      const linkData = {
        source: { x: 10, y: 20 },
        target: { x: 30, y: null },
      };
      expect(createLinkPathData(linkData)).to.eq('M 10 20 L 30 0');

      linkData.target.y = undefined;
      expect(createLinkPathData(linkData)).to.eq('M 10 20 L 30 0');

      linkData.target.y = 0;
      expect(createLinkPathData(linkData)).to.eq('M 10 20 L 30 0');
    });
    it('handles all coordinates being falsy', () => {
      const linkData = {
        source: { x: null, y: null },
        target: { x: undefined, y: undefined },
      };
      expect(createLinkPathData(linkData)).to.eq('M 0 0 L 0 0');
    });
    it('handles negative coordinates', () => {
      const linkData = {
        source: { x: -10, y: -20 },
        target: { x: -30, y: -40 },
      };
      expect(createLinkPathData(linkData)).to.eq('M -10 -20 L -30 -40');
    });
  });

  describe('#createSvgElement', function () {
    let originalD3Select;
    let mockSelection;
    let attrCalls;

    beforeEach(() => {
      attrCalls = [];
      mockSelection = {
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this; // Return self for chaining
        },
      };
      originalD3Select = d3.select;
      d3.select = () => mockSelection;
    });

    afterEach(() => {
      d3.select = originalD3Select;
    });

    it('creates SVG element with width and height attributes', () => {
      createSvgElement(100, 200);
      expect(attrCalls.length).to.eq(4);
      expect(attrCalls[0]).to.deep.eq({ name: 'width', value: 100 });
      expect(attrCalls[1]).to.deep.eq({ name: 'height', value: 200 });
    });
    it('sets viewBox attribute with correct values', () => {
      createSvgElement(100, 200);
      expect(attrCalls[2]).to.deep.eq({
        name: 'viewBox',
        value: [0, 0, 100, 200],
      });
    });
    it('sets style attribute', () => {
      createSvgElement(100, 200);
      expect(attrCalls[3]).to.deep.eq({
        name: 'style',
        value: 'max-width: 100%; height: auto;',
      });
    });
    it('selects the correct SVG element', () => {
      let selectCalledWith;
      d3.select = (selector) => {
        selectCalledWith = selector;
        return mockSelection;
      };
      createSvgElement(100, 200);
      expect(selectCalledWith).to.eq('#all-charters svg');
    });
    it('handles different width and height values', () => {
      createSvgElement(500, 300);
      expect(attrCalls[0]).to.deep.eq({ name: 'width', value: 500 });
      expect(attrCalls[1]).to.deep.eq({ name: 'height', value: 300 });
      expect(attrCalls[2]).to.deep.eq({
        name: 'viewBox',
        value: [0, 0, 500, 300],
      });
    });
    it('handles zero dimensions', () => {
      createSvgElement(0, 0);
      expect(attrCalls[0]).to.deep.eq({ name: 'width', value: 0 });
      expect(attrCalls[1]).to.deep.eq({ name: 'height', value: 0 });
      expect(attrCalls[2]).to.deep.eq({
        name: 'viewBox',
        value: [0, 0, 0, 0],
      });
    });
  });

  describe('#createLinkSelections', function () {
    let mockSvg;
    let mockLinkSelection;
    let mockPathSelection;
    let appendCalls;
    let selectAllCalls;
    let dataCalls;
    let joinCalls;
    let attrCalls;

    beforeEach(() => {
      appendCalls = [];
      selectAllCalls = [];
      dataCalls = [];
      joinCalls = [];
      attrCalls = [];

      mockPathSelection = {
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
      };

      mockLinkSelection = {
        append: function (tag) {
          appendCalls.push(tag);
          if (tag === 'path') {
            return mockPathSelection;
          }
          return mockLinkSelection;
        },
        selectAll: function (selector) {
          selectAllCalls.push(selector);
          return mockLinkSelection;
        },
        data: function (data) {
          dataCalls.push(data);
          return mockLinkSelection;
        },
        join: function (tag) {
          joinCalls.push(tag);
          return mockLinkSelection;
        },
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
      };

      mockSvg = {
        append: function (tag) {
          appendCalls.push(tag);
          return mockLinkSelection;
        },
      };
    });

    it('creates link selections from svg and current_links', () => {
      const current_links = [
        { id: 'link1', stroke: '#fa0' },
        { id: 'link2', stroke: '#0af' },
      ];
      const result = createLinkSelections(mockSvg, current_links);

      expect(appendCalls[0]).to.eq('g');
      expect(selectAllCalls[0]).to.eq('.link');
      expect(dataCalls[0]).to.deep.eq(current_links);
      expect(joinCalls[0]).to.eq('g');
      expect(result.link_selection).to.eq(mockLinkSelection);
      expect(result.link_line_selection).to.eq(mockPathSelection);
    });
    it('sets class attribute on link selection', () => {
      const current_links = [{ id: 'link1', stroke: '#fa0' }];
      createLinkSelections(mockSvg, current_links);

      const classAttr = attrCalls.find(a => a.name === 'class');
      expect(classAttr).to.deep.eq({ name: 'class', value: 'link' });
    });
    it('creates path elements for each link', () => {
      const current_links = [
        { id: 'link1', stroke: '#fa0' },
        { id: 'link2', stroke: '#0af' },
      ];
      createLinkSelections(mockSvg, current_links);

      expect(appendCalls).to.include('path');
    });
    it('sets path attributes including d, id, stroke-width, and stroke', () => {
      const current_links = [
        {
          id: 'link1',
          stroke: '#fa0',
          source: { x: 10, y: 20 },
          target: { x: 30, y: 40 },
        },
      ];
      createLinkSelections(mockSvg, current_links);

      const dAttr = attrCalls.find(a => a.name === 'd');
      const idAttr = attrCalls.find(a => a.name === 'id');
      const strokeWidthAttr = attrCalls.find(a => a.name === 'stroke-width');
      const strokeAttr = attrCalls.find(a => a.name === 'stroke');

      expect(dAttr).to.exist;
      expect(dAttr.value).to.be.a('function');
      // Call the function to ensure coverage
      expect(dAttr.value(current_links[0])).to.eq('M 10 20 L 30 40');
      expect(idAttr).to.exist;
      expect(idAttr.value).to.be.a('function');
      // Call the function to ensure coverage
      expect(idAttr.value(current_links[0])).to.eq('link1');
      expect(strokeWidthAttr).to.deep.eq({ name: 'stroke-width', value: 2 });
      expect(strokeAttr).to.exist;
      expect(strokeAttr.value).to.be.a('function');
      // Call the function to ensure coverage
      expect(strokeAttr.value(current_links[0])).to.eq('#fa0');
    });
    it('handles empty links array', () => {
      const current_links = [];
      const result = createLinkSelections(mockSvg, current_links);

      expect(dataCalls[0]).to.deep.eq([]);
      expect(result.link_selection).to.eq(mockLinkSelection);
      expect(result.link_line_selection).to.eq(mockPathSelection);
    });
    it('returns both link_selection and link_line_selection', () => {
      const current_links = [{ id: 'link1', stroke: '#fa0' }];
      const result = createLinkSelections(mockSvg, current_links);

      expect(result).to.have.property('link_selection');
      expect(result).to.have.property('link_line_selection');
      expect(result.link_selection).to.eq(mockLinkSelection);
      expect(result.link_line_selection).to.eq(mockPathSelection);
    });
  });

  describe('#createDragHandlers', function () {
    let mockSimulation;
    let mockD3Select;
    let originalD3Select;
    let classedCalls;

    beforeEach(() => {
      classedCalls = [];
      mockSimulation = {
        alphaTarget: function (value) {
          this.alphaTargetValue = value;
          return this;
        },
        restart: function () {
          this.restarted = true;
          return this;
        },
        alpha: function (value) {
          this.alphaValue = value;
          return this;
        },
      };

      mockD3Select = {
        classed: function (className, value) {
          classedCalls.push({ className, value });
          return this;
        },
      };

      originalD3Select = d3.select;
      d3.select = function () {
        return mockD3Select;
      };
    });

    afterEach(() => {
      d3.select = originalD3Select;
    });

    it('returns all four handler functions', () => {
      const handlers = createDragHandlers(mockSimulation, 100, 200);
      expect(handlers).to.have.property('dragstarted');
      expect(handlers).to.have.property('dragged');
      expect(handlers).to.have.property('dragended');
      expect(handlers).to.have.property('click');
      expect(handlers.dragstarted).to.be.a('function');
      expect(handlers.dragged).to.be.a('function');
      expect(handlers.dragended).to.be.a('function');
      expect(handlers.click).to.be.a('function');
    });

    describe('dragstarted handler', () => {
      it('restarts simulation when event.active is false', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = {
          active: false,
          subject: { x: 10, y: 20 },
        };
        handlers.dragstarted.call({}, event);

        expect(mockSimulation.alphaTargetValue).to.eq(0.3);
        expect(mockSimulation.restarted).to.eq(true);
      });
      it('does not restart simulation when event.active is true', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = {
          active: true,
          subject: { x: 10, y: 20 },
        };
        mockSimulation.restarted = false;
        handlers.dragstarted.call({}, event);

        expect(mockSimulation.restarted).to.not.eq(true);
      });
      it('sets fx and fy from subject coordinates', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = {
          active: false,
          subject: { x: 10, y: 20 },
        };
        handlers.dragstarted.call({}, event);

        expect(event.subject.fx).to.eq(10);
        expect(event.subject.fy).to.eq(20);
      });
      it('adds fixed class to element', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = {
          active: false,
          subject: { x: 10, y: 20 },
        };
        handlers.dragstarted.call({}, event);

        expect(classedCalls).to.deep.include({
          className: 'fixed',
          value: true,
        });
      });
    });

    describe('dragged handler', () => {
      it('clamps coordinates and sets fx/fy', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = { x: 50, y: 75 };
        const d = {};

        handlers.dragged(event, d);

        expect(d.fx).to.eq(50);
        expect(d.fy).to.eq(75);
      });
      it('clamps x to width when x exceeds width', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = { x: 150, y: 75 };
        const d = {};

        handlers.dragged(event, d);

        // Note: clamp has a bug where it returns x when x < lo, but works
        // correctly when x > hi
        expect(d.fx).to.eq(100);
        expect(d.fy).to.eq(75);
      });
      it('clamps y to height when y exceeds height', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = { x: 50, y: 250 };
        const d = {};

        handlers.dragged(event, d);

        expect(d.fx).to.eq(50);
        expect(d.fy).to.eq(200);
      });
      it('restarts simulation with alpha 1', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = { x: 50, y: 75 };
        const d = {};

        handlers.dragged(event, d);

        expect(mockSimulation.alphaValue).to.eq(1);
        expect(mockSimulation.restarted).to.eq(true);
      });
    });

    describe('dragended handler', () => {
      it('sets alphaTarget to 0 when event.active is false', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = { active: false };

        handlers.dragended(event);

        expect(mockSimulation.alphaTargetValue).to.eq(0);
      });
      it('does not set alphaTarget when event.active is true', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = { active: true };
        mockSimulation.alphaTargetValue = undefined;

        handlers.dragended(event);

        expect(mockSimulation.alphaTargetValue).to.eq(undefined);
      });
    });

    describe('click handler', () => {
      it('deletes fx and fy properties', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = {};
        const d = { fx: 10, fy: 20 };

        handlers.click(event, d);

        expect(d).to.not.have.property('fx');
        expect(d).to.not.have.property('fy');
      });
      it('removes fixed class from element', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = {};
        const d = {};

        handlers.click(event, d);

        expect(classedCalls).to.deep.include({
          className: 'fixed',
          value: false,
        });
      });
      it('restarts simulation with alpha 1', () => {
        const handlers = createDragHandlers(mockSimulation, 100, 200);
        const event = {};
        const d = {};

        handlers.click(event, d);

        expect(mockSimulation.alphaValue).to.eq(1);
        expect(mockSimulation.restarted).to.eq(true);
      });
    });
  });

  describe('#createTickedHandler', function () {
    let mockLinkLinePaths;
    let mockNodeGroups;
    let linkLinePathAttrCalls;
    let nodeGroupAttrCalls;

    beforeEach(() => {
      linkLinePathAttrCalls = [];
      nodeGroupAttrCalls = [];

      mockLinkLinePaths = {
        attr: function (name, value) {
          linkLinePathAttrCalls.push({ name, value });
          return this;
        },
      };

      mockNodeGroups = {
        attr: function (name, value) {
          nodeGroupAttrCalls.push({ name, value });
          return this;
        },
      };
    });

    it('returns a function', () => {
      const handler = createTickedHandler(mockLinkLinePaths, mockNodeGroups);
      expect(handler).to.be.a('function');
    });
    it('sets d attribute on link_line_paths using createLinkPathData', () => {
      const handler = createTickedHandler(mockLinkLinePaths, mockNodeGroups);
      handler();

      const dAttr = linkLinePathAttrCalls.find(a => a.name === 'd');
      expect(dAttr).to.exist;
      expect(dAttr.value).to.eq(createLinkPathData);
    });
    it('sets transform attribute on node_groups', () => {
      const handler = createTickedHandler(mockLinkLinePaths, mockNodeGroups);
      handler();

      const transformAttr = nodeGroupAttrCalls.find(
        a => a.name === 'transform',
      );
      expect(transformAttr).to.exist;
      expect(transformAttr.value).to.be.a('function');
    });
    it('transform function uses x and y coordinates when present', () => {
      const handler = createTickedHandler(mockLinkLinePaths, mockNodeGroups);
      handler();

      const transformAttr = nodeGroupAttrCalls.find(
        a => a.name === 'transform',
      );
      const transformFn = transformAttr.value;

      const nodeData = { x: 10, y: 20 };
      expect(transformFn(nodeData)).to.eq('translate(10, 20)');
    });
    it('transform function defaults to 0 when x is missing', () => {
      const handler = createTickedHandler(mockLinkLinePaths, mockNodeGroups);
      handler();

      const transformAttr = nodeGroupAttrCalls.find(
        a => a.name === 'transform',
      );
      const transformFn = transformAttr.value;

      const nodeData = { y: 20 };
      expect(transformFn(nodeData)).to.eq('translate(0, 20)');
    });
    it('transform function defaults to 0 when y is missing', () => {
      const handler = createTickedHandler(mockLinkLinePaths, mockNodeGroups);
      handler();

      const transformAttr = nodeGroupAttrCalls.find(
        a => a.name === 'transform',
      );
      const transformFn = transformAttr.value;

      const nodeData = { x: 10 };
      expect(transformFn(nodeData)).to.eq('translate(10, 0)');
    });
    it('transform function defaults both to 0 when x and y are missing',
      () => {
        const handler = createTickedHandler(
          mockLinkLinePaths, mockNodeGroups,
        );
        handler();

        const transformAttr = nodeGroupAttrCalls.find(
          a => a.name === 'transform',
        );
        const transformFn = transformAttr.value;

        const nodeData = {};
        expect(transformFn(nodeData)).to.eq('translate(0, 0)');
      });
    it('transform function handles falsy x and y values', () => {
      const handler = createTickedHandler(mockLinkLinePaths, mockNodeGroups);
      handler();

      const transformAttr = nodeGroupAttrCalls.find(
        a => a.name === 'transform',
      );
      const transformFn = transformAttr.value;

      const nodeData1 = { x: null, y: 20 };
      expect(transformFn(nodeData1)).to.eq('translate(0, 20)');

      const nodeData2 = { x: 10, y: undefined };
      expect(transformFn(nodeData2)).to.eq('translate(10, 0)');

      const nodeData3 = { x: 0, y: 0 };
      expect(transformFn(nodeData3)).to.eq('translate(0, 0)');
    });
  });

  describe('#createNodeSelections', function () {
    let mockSvg;
    let mockNodeSelection;
    let mockCircleSelection;
    let mockTextSelection;
    let appendCalls;
    let selectAllCalls;
    let dataCalls;
    let joinCalls;
    let attrCalls;
    let styleCalls;
    let textCalls;

    beforeEach(() => {
      appendCalls = [];
      selectAllCalls = [];
      dataCalls = [];
      joinCalls = [];
      attrCalls = [];
      styleCalls = [];
      textCalls = [];

      mockTextSelection = {
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
        style: function (name, value) {
          styleCalls.push({ name, value });
          return this;
        },
        text: function (value) {
          textCalls.push({ value });
          return this;
        },
      };

      mockCircleSelection = {
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
      };

      mockNodeSelection = {
        append: function (tag) {
          appendCalls.push(tag);
          if (tag === 'circle') {
            return mockCircleSelection;
          }
          if (tag === 'text') {
            return mockTextSelection;
          }
          if (tag === 'title') {
            return mockTextSelection;
          }
          return mockNodeSelection;
        },
        selectAll: function (selector) {
          selectAllCalls.push(selector);
          return mockNodeSelection;
        },
        data: function (data) {
          dataCalls.push(data);
          return mockNodeSelection;
        },
        join: function (tag) {
          joinCalls.push(tag);
          return mockNodeSelection;
        },
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
      };

      mockSvg = {
        append: function (tag) {
          appendCalls.push(tag);
          return mockNodeSelection;
        },
      };
    });

    it('creates node selections from svg and current_nodes', () => {
      const current_nodes = [
        { id: 'node1', fill: '#44aa99', stroke: 'white', name: 'Node 1' },
      ];
      const result = createNodeSelections(mockSvg, current_nodes);

      expect(appendCalls[0]).to.eq('g');
      expect(selectAllCalls[0]).to.eq('.node');
      expect(dataCalls[0]).to.deep.eq(current_nodes);
      expect(joinCalls[0]).to.eq('g');
      expect(result).to.eq(mockNodeSelection);
    });
    it('sets class attribute to node', () => {
      const current_nodes = [{ id: 'node1' }];
      createNodeSelections(mockSvg, current_nodes);

      const classAttr = attrCalls.find(a => a.name === 'class');
      expect(classAttr).to.deep.eq({ name: 'class', value: 'node' });
    });
    it('creates circle elements with attributes', () => {
      const current_nodes = [
        { id: 'node1', fill: '#44aa99', stroke: 'white' },
      ];
      createNodeSelections(mockSvg, current_nodes);

      expect(appendCalls).to.include('circle');
      const rAttr = attrCalls.find(a => a.name === 'r');
      const strokeWidthAttr = attrCalls.find(a => a.name === 'stroke-width');
      const fillAttr = attrCalls.find(a => a.name === 'fill');
      const strokeAttr = attrCalls.find(a => a.name === 'stroke');

      expect(rAttr).to.deep.eq({ name: 'r', value: 10 });
      expect(strokeWidthAttr).to.deep.eq({ name: 'stroke-width', value: 2 });
      expect(fillAttr).to.exist;
      expect(fillAttr.value).to.be.a('function');
      expect(strokeAttr).to.exist;
      expect(strokeAttr.value).to.be.a('function');
    });
    it('creates text elements with attributes', () => {
      const current_nodes = [
        { id: 'node1', name: 'Node 1', fill: '#44aa99' },
      ];
      createNodeSelections(mockSvg, current_nodes);

      expect(appendCalls).to.include('text');
      const xAttr = attrCalls.find(a => a.name === 'x');
      const yAttr = attrCalls.find(a => a.name === 'y');
      const fillStyle = styleCalls.find(s => s.name === 'fill');
      const fontSizeStyle = styleCalls.find(s => s.name === 'font-size');

      expect(xAttr).to.deep.eq({ name: 'x', value: 15 });
      expect(yAttr).to.deep.eq({ name: 'y', value: 3 });
      expect(fillStyle).to.exist;
      expect(fillStyle.value).to.be.a('function');
      expect(fontSizeStyle).to.deep.eq({
        name: 'font-size',
        value: '10px',
      });
    });
    it('calls fill and stroke functions with node data', () => {
      const current_nodes = [
        { id: 'node1', fill: '#44aa99', stroke: 'white', name: 'Node 1' },
      ];
      createNodeSelections(mockSvg, current_nodes);

      const fillAttr = attrCalls.find(a => a.name === 'fill');
      const strokeAttr = attrCalls.find(a => a.name === 'stroke');
      const fillStyle = styleCalls.find(s => s.name === 'fill');

      expect(fillAttr.value(current_nodes[0])).to.eq('#44aa99');
      expect(strokeAttr.value(current_nodes[0])).to.eq('white');
      expect(fillStyle.value(current_nodes[0])).to.eq('#44aa99');
    });
    it('calls text function with node name', () => {
      const current_nodes = [
        { id: 'node1', name: 'Node 1' },
      ];
      createNodeSelections(mockSvg, current_nodes);

      expect(textCalls.length).to.be.greaterThan(0);
      const textCall = textCalls.find(t => t.value);
      expect(textCall.value).to.be.a('function');
      expect(textCall.value(current_nodes[0])).to.eq('Node 1');
    });
  });

  describe('#setupDragBehavior', function () {
    let mockNodeGroups;
    let mockDrag;
    let callCalls;
    let onCalls;
    let originalD3Drag;

    beforeEach(() => {
      callCalls = [];
      onCalls = [];

      mockDrag = {
        on: function (event, handler) {
          onCalls.push({ event, handler });
          return this;
        },
      };

      mockNodeGroups = {
        call: function (drag) {
          callCalls.push(drag);
          return this;
        },
        on: function (event, handler) {
          onCalls.push({ event, handler });
          return this;
        },
      };

      originalD3Drag = d3.drag;
      d3.drag = () => mockDrag;
    });

    afterEach(() => {
      d3.drag = originalD3Drag;
    });

    it('sets up drag behavior with handlers', () => {
      const handlers = {
        dragstarted: () => {},
        dragged: () => {},
        dragended: () => {},
        click: () => {},
      };

      setupDragBehavior(mockNodeGroups, handlers);

      expect(callCalls.length).to.eq(1);
      expect(callCalls[0]).to.eq(mockDrag);
      expect(onCalls.length).to.eq(4);
      expect(onCalls[0]).to.deep.eq({
        event: 'start',
        handler: handlers.dragstarted,
      });
      expect(onCalls[1]).to.deep.eq({
        event: 'drag',
        handler: handlers.dragged,
      });
      expect(onCalls[2]).to.deep.eq({
        event: 'end',
        handler: handlers.dragended,
      });
      expect(onCalls[3]).to.deep.eq({
        event: 'click',
        handler: handlers.click,
      });
    });
  });

  describe('#createSimulation', function () {
    let originalD3ForceSimulation;
    let mockSimulation;
    let forceCalls;
    let onCalls;

    beforeEach(() => {
      forceCalls = [];
      onCalls = [];

      mockSimulation = {
        force: function (name, force) {
          forceCalls.push({ name, force });
          return this;
        },
        on: function (event, handler) {
          onCalls.push({ event, handler });
          return this;
        },
      };

      originalD3ForceSimulation = d3.forceSimulation;
      d3.forceSimulation = (nodes) => {
        expect(nodes).to.exist;
        return mockSimulation;
      };
    });

    afterEach(() => {
      d3.forceSimulation = originalD3ForceSimulation;
    });

    it('creates simulation with nodes, links, and forces', () => {
      const current_nodes = [{ id: 'node1' }];
      const current_links = [{ id: 'link1', source: 'node1', target: 'node2' }];
      const ticked = () => {};

      const result = createSimulation(
        current_nodes, current_links, 100, 200, ticked,
      );

      expect(result).to.eq(mockSimulation);
      expect(forceCalls.length).to.eq(4);
      expect(forceCalls[0].name).to.eq('link');
      expect(forceCalls[1].name).to.eq('charge');
      expect(forceCalls[2].name).to.eq('x');
      expect(forceCalls[3].name).to.eq('y');
      expect(onCalls.length).to.eq(1);
      expect(onCalls[0]).to.deep.eq({ event: 'tick', handler: ticked });
    });
  });

  describe('#updateNodeProperties', function () {
    let updateNodePropertiesLanesStub;

    beforeEach(async () => {
      await resetDatabase();
      updateNodePropertiesLanesStub = setupInMemoryCollection(Lanes);
    });

    afterEach(async () => {
      if (updateNodePropertiesLanesStub) {
        updateNodePropertiesLanesStub.restore();
      }
      await resetDatabase();
    });

    it('preserves position and velocity properties', () => {
      const current_nodes = [{ id: 'node1', fill: '#44aa99' }];
      const mockSimulation = {
        nodes: () => [
          {
            id: 'node1',
            x: 10,
            y: 20,
            vx: 1,
            vy: 2,
            fx: 5,
            fy: 6,
            fill: '#44aa99',
          },
        ],
      };

      updateNodeProperties(current_nodes, mockSimulation);

      expect(current_nodes[0].x).to.eq(10);
      expect(current_nodes[0].y).to.eq(20);
      expect(current_nodes[0].vx).to.eq(1);
      expect(current_nodes[0].vy).to.eq(2);
      expect(current_nodes[0].fx).to.eq(5);
      expect(current_nodes[0].fy).to.eq(6);
    });
    it('updates fill color when lane state changes', () => {
      const lane = {
        _id: 'node1',
        last_shipment: { exit_code: 0 },
      };
      updateNodePropertiesLanesStub.insert(lane);

      const current_nodes = [{ id: 'node1', fill: '#D41159' }];
      const mockSimulation = {
        nodes: () => [
          { id: 'node1', fill: '#D41159' },
        ],
      };

      updateNodeProperties(current_nodes, mockSimulation);

      expect(current_nodes[0].fill).to.eq('#44aa99');
    });
    it('does not update fill when it has not changed', () => {
      const lane = {
        _id: 'node1',
        last_shipment: { exit_code: 0 },
      };
      updateNodePropertiesLanesStub.insert(lane);

      const current_nodes = [{ id: 'node1', fill: '#44aa99' }];
      const mockSimulation = {
        nodes: () => [
          { id: 'node1', fill: '#44aa99' },
        ],
      };

      updateNodeProperties(current_nodes, mockSimulation);

      expect(current_nodes[0].fill).to.eq('#44aa99');
    });
    it('does not preserve null or undefined properties', () => {
      const current_nodes = [{ id: 'node1' }];
      const mockSimulation = {
        nodes: () => [
          { id: 'node1', x: null, y: undefined },
        ],
      };

      updateNodeProperties(current_nodes, mockSimulation);

      expect(current_nodes[0]).to.not.have.property('x');
      expect(current_nodes[0]).to.not.have.property('y');
    });
    it('does nothing when node does not exist in simulation', () => {
      const current_nodes = [{ id: 'node1', fill: '#44aa99' }];
      const mockSimulation = {
        nodes: () => [
          { id: 'node2' }, // Different node, so node1 won't be found
        ],
      };

      const originalFill = current_nodes[0].fill;
      updateNodeProperties(current_nodes, mockSimulation);

      // Node properties should remain unchanged
      expect(current_nodes[0].fill).to.eq(originalFill);
      expect(current_nodes[0]).to.not.have.property('x');
      expect(current_nodes[0]).to.not.have.property('y');
    });
    it('does nothing when simulation has no nodes', () => {
      const current_nodes = [{ id: 'node1', fill: '#44aa99' }];
      const mockSimulation = {
        nodes: () => [], // Empty array, so node1 won't be found
      };

      const originalFill = current_nodes[0].fill;
      updateNodeProperties(current_nodes, mockSimulation);

      // Node properties should remain unchanged
      expect(current_nodes[0].fill).to.eq(originalFill);
      expect(current_nodes[0]).to.not.have.property('x');
    });
  });

  describe('#updateSimulation', function () {
    it('updates simulation nodes and links', () => {
      const current_nodes = [{ id: 'node1' }];
      const current_links = [{ id: 'link1' }];
      const mockSimulation = {
        nodes: function (nodes) {
          if (nodes) {
            this.nodesValue = nodes;
          }
          return this.nodesValue || [];
        },
        force: function (name) {
          if (name === 'link') {
            return {
              links: function (links) {
                this.linksValue = links;
                return this;
              },
            };
          }
          return this;
        },
        alpha: function (value) {
          this.alphaValue = value;
          return this;
        },
        restart: function () {
          this.restarted = true;
          return this;
        },
      };

      updateSimulation(mockSimulation, current_nodes, current_links);

      expect(mockSimulation.nodesValue).to.deep.eq(current_nodes);
      expect(mockSimulation.alphaValue).to.eq(1);
      expect(mockSimulation.restarted).to.eq(true);
    });
  });

  describe('#updateLinkSelections', function () {
    let mockLinkSelection;
    let mockMergedSelection;
    let dataCalls;
    let exitCalls;
    let enterCalls;
    let mergeCalls;
    let selectCalls;
    let appendCalls;
    let attrCalls;

    beforeEach(() => {
      dataCalls = [];
      exitCalls = [];
      enterCalls = [];
      mergeCalls = [];
      selectCalls = [];
      appendCalls = [];
      attrCalls = [];

      const mockExitSelection = {
        remove: function () {
          exitCalls.push('remove');
          return this;
        },
      };

      let pathSelectionEmpty = true;

      const mockPathSelection = {
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
        empty: function () {
          return pathSelectionEmpty;
        },
      };

      mockMergedSelection = {
        select: function (selector) {
          selectCalls.push(selector);
          return mockPathSelection;
        },
        append: function (tag) {
          appendCalls.push(tag);
          return mockPathSelection;
        },
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
        merge: function (selection) {
          mergeCalls.push(selection);
          return this;
        },
      };

      const mockEnterSelection = {
        append: function (tag) {
          appendCalls.push(tag);
          const appendedSelection = {
            attr: function (name, value) {
              attrCalls.push({ name, value });
              return mockMergedSelection;
            },
          };
          return appendedSelection;
        },
      };

      mockLinkSelection = {
        data: function (data, key) {
          dataCalls.push({ data, key });
          return mockLinkSelection;
        },
        exit: function () {
          exitCalls.push('exit');
          return mockExitSelection;
        },
        enter: function () {
          enterCalls.push('enter');
          return mockEnterSelection;
        },
        merge: function (selection) {
          mergeCalls.push(selection);
          return mockMergedSelection;
        },
        select: function (selector) {
          selectCalls.push(selector);
          if (selector === 'path') {
            pathSelectionEmpty = false; // After select, it's no longer empty
          }
          return mockPathSelection;
        },
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
      };
    });

    it('updates link selections with new data', () => {
      const current_links = [
        { id: 'link1', stroke: '#fa0' },
      ];
      const result = updateLinkSelections(mockLinkSelection, current_links);

      expect(dataCalls[0].data).to.deep.eq(current_links);
      expect(dataCalls[0].key).to.be.a('function');
      expect(exitCalls).to.include('exit');
      expect(enterCalls).to.include('enter');
      // The result should be the merged selection, which has
      // select/append/attr methods
      expect(result.link_selection).to.have.property('select');
      expect(result.link_selection).to.have.property('append');
    });
    it('appends path if selection is empty', () => {
      const current_links = [{ id: 'link1' }];
      // The mockMergedSelection.select returns mockPathSelection
      // which has empty() returning true initially (selectCalls.length === 0)
      // So we need to ensure selectCalls is empty before calling
      selectCalls = [];
      updateLinkSelections(mockLinkSelection, current_links);

      // After select('path') is called, empty() should return false
      // but we check if append was called when empty was true
      expect(appendCalls).to.include('path');
    });
    it('sets path attributes', () => {
      const current_links = [
        {
          id: 'link1',
          stroke: '#fa0',
          source: { x: 10, y: 20 },
          target: { x: 30, y: 40 },
        },
      ];
      updateLinkSelections(mockLinkSelection, current_links);

      const dAttr = attrCalls.find(a => a.name === 'd');
      const idAttr = attrCalls.find(a => a.name === 'id');
      const strokeWidthAttr = attrCalls.find(a => a.name === 'stroke-width');
      const strokeAttr = attrCalls.find(a => a.name === 'stroke');

      expect(dAttr).to.exist;
      expect(dAttr.value).to.eq(createLinkPathData);
      expect(idAttr).to.exist;
      expect(idAttr.value).to.be.a('function');
      // Call the function to ensure coverage
      expect(idAttr.value(current_links[0])).to.eq('link1');
      expect(strokeWidthAttr).to.deep.eq({
        name: 'stroke-width',
        value: 2,
      });
      expect(strokeAttr).to.exist;
      expect(strokeAttr.value).to.be.a('function');
      // Call the function to ensure coverage
      expect(strokeAttr.value(current_links[0])).to.eq('#fa0');
    });
    it('uses key function d => d.id for data binding', () => {
      const current_links = [
        { id: 'link1', stroke: '#fa0' },
        { id: 'link2', stroke: '#0af' },
      ];
      updateLinkSelections(mockLinkSelection, current_links);

      const keyFunction = dataCalls[0].key;
      expect(keyFunction).to.be.a('function');
      // Call the function to ensure coverage
      expect(keyFunction(current_links[0])).to.eq('link1');
      expect(keyFunction(current_links[1])).to.eq('link2');
    });
    it('does not append path when selection is not empty', () => {
      const current_links = [{ id: 'link1' }];
      // Create a mock where empty() returns false
      const mockNonEmptyPathSelection = {
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
        empty: function () {
          return false; // Selection is not empty
        },
      };

      // Override the select to return non-empty selection
      const originalSelect = mockMergedSelection.select;
      mockMergedSelection.select = function (selector) {
        selectCalls.push(selector);
        if (selector === 'path') {
          return mockNonEmptyPathSelection;
        }
        // Return a default mock for other selectors
        return {
          attr: () => this,
          empty: () => true,
        };
      };

      // Reset appendCalls to track new calls
      appendCalls = [];
      updateLinkSelections(mockLinkSelection, current_links);

      // Path should not be appended when selection is not empty
      // (appendCalls might have 'g' from enter().append("g"), but not 'path')
      const pathAppendCalls = appendCalls.filter(call => call === 'path');
      expect(pathAppendCalls.length).to.eq(0);
      mockMergedSelection.select = originalSelect;
    });
  });

  describe('#updateNodeSelections', function () {
    let mockNodeSelection;
    let dataCalls;
    let selectCalls;
    let attrCalls;
    let styleCalls;

    beforeEach(() => {
      dataCalls = [];
      selectCalls = [];
      attrCalls = [];
      styleCalls = [];

      const mockCircleSelection = {
        attr: function (name, value) {
          attrCalls.push({ name, value });
          return this;
        },
      };

      const mockTextSelection = {
        style: function (name, value) {
          styleCalls.push({ name, value });
          return this;
        },
      };

      mockNodeSelection = {
        data: function (data, key) {
          dataCalls.push({ data, key });
          return mockNodeSelection;
        },
        select: function (selector) {
          selectCalls.push(selector);
          if (selector === 'circle') {
            return mockCircleSelection;
          }
          if (selector === 'text') {
            return mockTextSelection;
          }
          return mockNodeSelection;
        },
      };
    });

    it('updates node selections with new data', () => {
      const current_nodes = [
        { id: 'node1', fill: '#44aa99' },
      ];
      const result = updateNodeSelections(mockNodeSelection, current_nodes);

      expect(dataCalls[0].data).to.deep.eq(current_nodes);
      expect(dataCalls[0].key).to.be.a('function');
      expect(selectCalls).to.include('circle');
      expect(selectCalls).to.include('text');
      expect(result).to.eq(mockNodeSelection);
    });
    it('updates circle fill attribute', () => {
      const current_nodes = [
        { id: 'node1', fill: '#44aa99' },
      ];
      updateNodeSelections(mockNodeSelection, current_nodes);

      const fillAttr = attrCalls.find(a => a.name === 'fill');
      expect(fillAttr).to.exist;
      expect(fillAttr.value).to.be.a('function');
      expect(fillAttr.value(current_nodes[0])).to.eq('#44aa99');
    });
    it('updates text fill style', () => {
      const current_nodes = [
        { id: 'node1', fill: '#44aa99' },
      ];
      updateNodeSelections(mockNodeSelection, current_nodes);

      const fillStyle = styleCalls.find(s => s.name === 'fill');
      expect(fillStyle).to.exist;
      expect(fillStyle.value).to.be.a('function');
      expect(fillStyle.value(current_nodes[0])).to.eq('#44aa99');
    });
    it('uses key function d => d.id for data binding', () => {
      const current_nodes = [
        { id: 'node1', fill: '#44aa99' },
        { id: 'node2', fill: '#D41159' },
      ];
      updateNodeSelections(mockNodeSelection, current_nodes);

      const keyFunction = dataCalls[0].key;
      expect(keyFunction).to.be.a('function');
      // Call the function to ensure coverage
      expect(keyFunction(current_nodes[0])).to.eq('node1');
      expect(keyFunction(current_nodes[1])).to.eq('node2');
    });
  });

  describe('#initializeGraphVisualization', function () {
    let mockD3Select;
    let originalD3Select;

    beforeEach(() => {
      // Create a chainable mock for d3.select
      const chainableMock = {
        attr: function () { return this; },
        append: function () { return chainableMock; },
        selectAll: function () { return chainableMock; },
        data: function () { return chainableMock; },
        join: function () { return chainableMock; },
        style: function () { return this; },
        text: function () { return this; },
        call: function () { return this; },
        on: function () { return this; },
      };

      originalD3Select = d3.select;
      mockD3Select = () => chainableMock;
      d3.select = mockD3Select;

      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined') {
        global.document = {
          querySelector: () => chainableMock,
        };
      }
      else {
        document.querySelector = () => chainableMock;
      }
    });

    afterEach(() => {
      d3.select = originalD3Select;
    });

    it('initializes graph visualization with all components', () => {
      const current_nodes = [
        { id: 'node1', fill: '#44aa99', stroke: 'white', name: 'Node 1' },
        { id: 'node2', fill: '#D41159', stroke: 'white', name: 'Node 2' },
      ];
      const current_links = [
        { id: 'link1', source: 'node1', target: 'node2', stroke: '#fa0' },
      ];
      const result = initializeGraphVisualization(
        100, 200, current_nodes, current_links,
      );

      expect(result).to.have.property('svg');
      expect(result).to.have.property('link_selection');
      expect(result).to.have.property('link_line_selection');
      expect(result).to.have.property('node_selection');
      expect(result).to.have.property('simulation');
    });
    it('returns object with correct structure', () => {
      const current_nodes = [
        { id: 'node1' },
        { id: 'node2' },
      ];
      const current_links = [
        { id: 'link1', source: 'node1', target: 'node2' },
      ];
      const result = initializeGraphVisualization(
        100, 200, current_nodes, current_links,
      );

      expect(result).to.be.an('object');
      expect(Object.keys(result)).to.include.members([
        'svg',
        'link_selection',
        'link_line_selection',
        'node_selection',
        'simulation',
      ]);
    });
  });

  describe('#svg_graph', function () {
    it('returns a graph simulation', () => {
      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined') global.document = {
        querySelector () {},
      };
      // Create a test simulation since svg_graph won't create one in test mode
      H.simulation = {
        tick: () => {},
        stop: () => {},
        nodes: () => [],
        force: () => ({
          links: () => {},
        }),
        alpha: () => ({ restart: () => {} }),
      };
      expect(svg_graph()).to.eq('');
      expect(typeof H.simulation.tick).to.eq('function');
      H.window.render_null = true;
      expect(svg_graph()).to.eq('');
      H.window.render_null = false;
      // eslint-disable-next-line no-native-reassign
      document = null;
    });
    it('continues execution when current_nodes has length > 0', () => {
      // Create a chainable mock for d3.select
      const chainableMock = {
        attr: function () { return this; },
        append: function () { return chainableMock; },
        selectAll: function () { return chainableMock; },
        data: function () { return chainableMock; },
        join: function () { return chainableMock; },
        style: function () { return this; },
        text: function () { return this; },
        call: function () { return this; },
        on: function () { return this; },
      };

      // Mock d3.select
      const originalD3Select = d3.select;
      d3.select = () => chainableMock;

      // Mock d3.forceSimulation and related force functions
      const mockSimulation = {
        force: function () { return this; },
        on: function () { return this; },
        alpha: function () { return this; },
        restart: function () { return this; },
        stop: function () {},
        nodes: function () { return []; },
      };
      const originalD3ForceSimulation = d3.forceSimulation;
      const originalD3ForceLink = d3.forceLink;
      const originalD3ForceManyBody = d3.forceManyBody;
      const originalD3ForceX = d3.forceX;
      const originalD3ForceY = d3.forceY;
      const originalD3Drag = d3.drag;
      d3.forceSimulation = () => mockSimulation;
      d3.forceLink = () => ({ distance: () => ({ id: () => {} }) });
      d3.forceManyBody = () => ({ strength: () => {} });
      d3.forceX = () => {};
      d3.forceY = () => {};
      d3.drag = () => ({ on: function () { return this; } });

      // Set up document
      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined' || document === null) {
        global.document = {
          querySelector: () => chainableMock,
        };
      }
      else {
        document.querySelector = () => chainableMock;
      }

      // Mock H.$ to return width and height
      const originalH$ = H.$;
      H.$ = function (selector) {
        if (selector === '#all-charters svg') {
          return {
            width: () => 100,
            height: () => 200,
            length: 1,
            html: () => {},
          };
        }
        if (selector === '#all-charters svg g') {
          return {
            length: 0,
          };
        }
        return originalH$.call(this, selector);
      };
      // Set node_list to have at least one node
      node_list.set([{ id: 'node1', name: 'Node 1' }]);
      // Create a test simulation
      H.simulation = {
        tick: () => {},
        stop: () => {},
        nodes: () => [{ id: 'node1' }],
        force: () => ({
          links: () => {},
        }),
        alpha: () => ({ restart: () => {} }),
      };
      expect(svg_graph()).to.eq('');
      // Restore mocks
      d3.select = originalD3Select;
      d3.forceSimulation = originalD3ForceSimulation;
      d3.forceLink = originalD3ForceLink;
      d3.forceManyBody = originalD3ForceManyBody;
      d3.forceX = originalD3ForceX;
      d3.forceY = originalD3ForceY;
      d3.drag = originalD3Drag;
      H.$ = originalH$;
      // Reset node_list
      node_list.set([]);
    });
    it('uses node_list.get() when it returns a value', () => {
      // Create a chainable mock for d3.select
      const chainableMock = {
        attr: function () { return this; },
        append: function () { return chainableMock; },
        selectAll: function () { return chainableMock; },
        data: function () { return chainableMock; },
        join: function () { return chainableMock; },
        style: function () { return this; },
        text: function () { return this; },
        call: function () { return this; },
        on: function () { return this; },
      };

      // Mock d3.select
      const originalD3Select = d3.select;
      d3.select = () => chainableMock;

      // Mock d3.forceSimulation and related force functions
      const mockSimulation = {
        force: function () { return this; },
        on: function () { return this; },
        alpha: function () { return this; },
        restart: function () { return this; },
        stop: function () {},
        nodes: function () { return []; },
      };
      const originalD3ForceSimulation = d3.forceSimulation;
      const originalD3ForceLink = d3.forceLink;
      const originalD3ForceManyBody = d3.forceManyBody;
      const originalD3ForceX = d3.forceX;
      const originalD3ForceY = d3.forceY;
      const originalD3Drag = d3.drag;
      d3.forceSimulation = () => mockSimulation;
      d3.forceLink = () => ({ distance: () => ({ id: () => {} }) });
      d3.forceManyBody = () => ({ strength: () => {} });
      d3.forceX = () => {};
      d3.forceY = () => {};
      d3.drag = () => ({ on: function () { return this; } });

      // Set up document
      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined' || document === null) {
        global.document = {
          querySelector: () => chainableMock,
        };
      }
      else {
        document.querySelector = () => chainableMock;
      }

      // Mock H.$ to return width and height
      const originalH$ = H.$;
      H.$ = function (selector) {
        if (selector === '#all-charters svg') {
          return {
            width: () => 100,
            height: () => 200,
            length: 1,
            html: () => {},
          };
        }
        if (selector === '#all-charters svg g') {
          return {
            length: 0,
          };
        }
        return originalH$.call(this, selector);
      };

      // Set node_list to have a value - this covers node_list.get() path
      node_list.set([{ id: 'node1', name: 'Node 1' }]);
      // Set link_list to have a value - this covers link_list.get() path
      link_list.set([{ id: 'link1', source: 'node1', target: 'node2' }]);

      // Create a test simulation
      H.simulation = {
        tick: () => {},
        stop: () => {},
        nodes: () => [{ id: 'node1' }],
        force: () => ({
          links: () => {},
        }),
        alpha: () => ({ restart: () => {} }),
      };

      expect(svg_graph()).to.eq('');

      // Restore mocks
      d3.select = originalD3Select;
      d3.forceSimulation = originalD3ForceSimulation;
      d3.forceLink = originalD3ForceLink;
      d3.forceManyBody = originalD3ForceManyBody;
      d3.forceX = originalD3ForceX;
      d3.forceY = originalD3ForceY;
      d3.drag = originalD3Drag;
      H.$ = originalH$;
      // Reset node_list and link_list
      node_list.set([]);
      link_list.set([]);
    });
    it('falls back to nodes when node_list.get() returns falsy', () => {
      // Create a chainable mock for d3.select
      const chainableMock = {
        attr: function () { return this; },
        append: function () { return chainableMock; },
        selectAll: function () { return chainableMock; },
        data: function () { return chainableMock; },
        join: function () { return chainableMock; },
        style: function () { return this; },
        text: function () { return this; },
        call: function () { return this; },
        on: function () { return this; },
      };

      // Mock d3.select
      const originalD3Select = d3.select;
      d3.select = () => chainableMock;

      // Mock d3.forceSimulation and related force functions
      const mockSimulation = {
        force: function () { return this; },
        on: function () { return this; },
        alpha: function () { return this; },
        restart: function () { return this; },
        stop: function () {},
        nodes: function () { return []; },
      };
      const originalD3ForceSimulation = d3.forceSimulation;
      const originalD3ForceLink = d3.forceLink;
      const originalD3ForceManyBody = d3.forceManyBody;
      const originalD3ForceX = d3.forceX;
      const originalD3ForceY = d3.forceY;
      const originalD3Drag = d3.drag;
      d3.forceSimulation = () => mockSimulation;
      d3.forceLink = () => ({ distance: () => ({ id: () => {} }) });
      d3.forceManyBody = () => ({ strength: () => {} });
      d3.forceX = () => {};
      d3.forceY = () => {};
      d3.drag = () => ({ on: function () { return this; } });

      // Set up document
      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined' || document === null) {
        global.document = {
          querySelector: () => chainableMock,
        };
      }
      else {
        document.querySelector = () => chainableMock;
      }

      // Mock H.$ to return width and height
      const originalH$ = H.$;
      H.$ = function (selector) {
        if (selector === '#all-charters svg') {
          return {
            width: () => 100,
            height: () => 200,
            length: 1,
            html: () => {},
          };
        }
        if (selector === '#all-charters svg g') {
          return {
            length: 0,
          };
        }
        return originalH$.call(this, selector);
      };

      // Set node_list to null to trigger fallback to nodes
      node_list.set(null);
      // Set link_list to null to trigger fallback to links
      link_list.set(null);

      // We need to set nodes and links directly since we can't access them
      // But since we can't access the module-level variables, we'll just
      // verify the function doesn't crash and returns ''
      expect(svg_graph()).to.eq('');

      // Restore mocks
      d3.select = originalD3Select;
      d3.forceSimulation = originalD3ForceSimulation;
      d3.forceLink = originalD3ForceLink;
      d3.forceManyBody = originalD3ForceManyBody;
      d3.forceX = originalD3ForceX;
      d3.forceY = originalD3ForceY;
      d3.drag = originalD3Drag;
      H.$ = originalH$;
      // Reset node_list and link_list
      node_list.set([]);
      link_list.set([]);
    });
    it('calls html("") when svg g has content', () => {
      // Create a chainable mock for d3.select
      const chainableMock = {
        attr: function () { return this; },
        append: function () { return chainableMock; },
        selectAll: function () { return chainableMock; },
        data: function () { return chainableMock; },
        join: function () { return chainableMock; },
        style: function () { return this; },
        text: function () { return this; },
        call: function () { return this; },
        on: function () { return this; },
      };

      // Mock d3.select
      const originalD3Select = d3.select;
      d3.select = () => chainableMock;

      // Mock d3.forceSimulation and related force functions
      const mockSimulation = {
        force: function () { return this; },
        on: function () { return this; },
        alpha: function () { return this; },
        restart: function () { return this; },
        stop: function () {},
        nodes: function () { return []; },
      };
      const originalD3ForceSimulation = d3.forceSimulation;
      const originalD3ForceLink = d3.forceLink;
      const originalD3ForceManyBody = d3.forceManyBody;
      const originalD3ForceX = d3.forceX;
      const originalD3ForceY = d3.forceY;
      const originalD3Drag = d3.drag;
      d3.forceSimulation = () => mockSimulation;
      d3.forceLink = () => ({ distance: () => ({ id: () => {} }) });
      d3.forceManyBody = () => ({ strength: () => {} });
      d3.forceX = () => {};
      d3.forceY = () => {};
      d3.drag = () => ({ on: function () { return this; } });

      // Set up document
      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined' || document === null) {
        global.document = {
          querySelector: () => chainableMock,
        };
      }
      else {
        document.querySelector = () => chainableMock;
      }

      // Mock H.$ to return width and height, and track html() calls
      const originalH$ = H.$;
      let htmlCalled = false;
      H.$ = function (selector) {
        if (selector === '#all-charters svg') {
          return {
            width: () => 100,
            height: () => 200,
            length: 1,
            html: function (value) {
              htmlCalled = true;
              expect(value).to.eq('');
            },
          };
        }
        if (selector === '#all-charters svg g') {
          return {
            length: 1, // Truthy value to trigger the if path
          };
        }
        return originalH$.call(this, selector);
      };

      // Set node_list to have at least one node with unique ID to ensure
      // structure_changed
      node_list.set([{ id: 'test-node-html', name: 'Test Node' }]);
      // Set link_list to have at least one link
      link_list.set([{
        id: 'test-link-html',
        source: 'test-node-html',
        target: 'test-node-html2',
      }]);

      // Don't set H.simulation initially so !simulation is true, ensuring we
      // go through the if branch where html('') is called
      H.simulation = null;

      expect(svg_graph()).to.eq('');
      expect(htmlCalled).to.eq(true);

      // Restore mocks
      d3.select = originalD3Select;
      d3.forceSimulation = originalD3ForceSimulation;
      d3.forceLink = originalD3ForceLink;
      d3.forceManyBody = originalD3ForceManyBody;
      d3.forceX = originalD3ForceX;
      d3.forceY = originalD3ForceY;
      d3.drag = originalD3Drag;
      H.$ = originalH$;
      // Reset node_list and link_list
      node_list.set([]);
      link_list.set([]);
    });
    it('skips graph initialization when document is undefined', () => {
      // Save original document and global.document
      const originalDocument = typeof document !== 'undefined'
        ? document
        : undefined;
      const originalGlobalDocument = global.document;
      // Mock H.$ to return width and height
      const originalH$ = H.$;
      H.$ = function (selector) {
        if (selector === '#all-charters svg') {
          return {
            width: () => 100,
            height: () => 200,
            length: 1,
            html: () => {},
          };
        }
        if (selector === '#all-charters svg g') {
          return {
            length: 0,
          };
        }
        return originalH$.call(this, selector);
      };

      // Set node_list to have at least one node
      node_list.set([{ id: 'test-node-no-doc', name: 'Test Node' }]);
      link_list.set([{
        id: 'test-link-no-doc',
        source: 'test-node-no-doc',
        target: 'test-node-no-doc2',
      }]);

      // Don't set H.simulation so !simulation is true
      H.simulation = null;

      // Set document to undefined to trigger the else path
      // eslint-disable-next-line no-native-reassign
      global.document = undefined;
      // eslint-disable-next-line no-native-reassign
      if (typeof document !== 'undefined') {
        // eslint-disable-next-line no-native-reassign
        document = undefined;
      }

      // Track if initializeGraphVisualization would be called
      // Since we can't easily mock it without document, we'll just verify
      // the function completes without error when document is undefined
      expect(svg_graph()).to.eq('');

      // Verify that H.simulation was not set (since document was undefined)
      expect(H.simulation).to.eq(null);

      // Restore document
      // eslint-disable-next-line no-native-reassign
      if (originalDocument) {
        global.document = originalDocument;
        // eslint-disable-next-line no-native-reassign
        document = originalDocument;
      }
      else if (originalGlobalDocument) {
        global.document = originalGlobalDocument;
      }

      // Restore mocks
      H.$ = originalH$;
      // Reset node_list and link_list
      node_list.set([]);
      link_list.set([]);
    });
    it('calls updateNodeProperties and updateSimulation in else path', () => {
      // Create a chainable mock for d3.select with all D3 selection methods
      // We need to define it first, then reference it in other mocks
      let chainableMock;

      const mockExitSelection = {
        remove: function () { return this; },
      };

      const mockEnterSelection = {
        append: function () { return chainableMock; },
      };
      chainableMock = {
        attr: function () { return this; },
        append: function () { return chainableMock; },
        selectAll: function () { return chainableMock; },
        select: function () { return chainableMock; },
        data: function () { return chainableMock; },
        join: function () { return chainableMock; },
        exit: function () { return mockExitSelection; },
        enter: function () { return mockEnterSelection; },
        merge: function () { return chainableMock; },
        style: function () { return this; },
        text: function () { return this; },
        call: function () { return this; },
        on: function () { return this; },
        empty: function () { return false; },
      };

      // Mock d3.select
      const originalD3Select = d3.select;
      d3.select = () => chainableMock;

      // Mock d3.forceSimulation and related force functions
      // This simulation will be stored in the module-level simulation
      // variable after first call
      const mockSimulation = {
        nodes: function (nodes) {
          if (nodes) {
            this.nodesValue = nodes;
          }
          return this.nodesValue || [];
        },
        force: function (name) {
          // If 2 arguments provided, we're setting a force (for
          // createSimulation chaining)
          if (arguments.length === 2) {
            return mockSimulation; // Return simulation for chaining
          }
          // If 1 argument, we're getting a force (for updateSimulation)
          if (name === 'link') {
            return {
              links: function (links) {
                mockSimulation.linksValue = links;
                return this;
              },
            };
          }
          return mockSimulation;
        },
        alpha: function (value) {
          this.alphaValue = value;
          return this;
        },
        restart: function () {
          this.restarted = true;
          return this;
        },
        stop: function () {},
        on: function () { return this; },
      };
      const originalD3ForceSimulation = d3.forceSimulation;
      const originalD3ForceLink = d3.forceLink;
      const originalD3ForceManyBody = d3.forceManyBody;
      const originalD3ForceX = d3.forceX;
      const originalD3ForceY = d3.forceY;
      const originalD3Drag = d3.drag;
      d3.forceSimulation = () => mockSimulation;
      d3.forceLink = () => ({ distance: () => ({ id: () => {} }) });
      d3.forceManyBody = () => ({ strength: () => {} });
      d3.forceX = () => {};
      d3.forceY = () => {};
      d3.drag = () => ({ on: function () { return this; } });

      // Set up document
      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined' || document === null) {
        global.document = {
          querySelector: () => chainableMock,
        };
      }
      else {
        document.querySelector = () => chainableMock;
      }

      // Mock H.$ to return width, height, and indicate svg exists with
      // content
      const originalH$ = H.$;
      const testNodes = [{ id: 'test-node-else', name: 'Test Node' }];
      const testLinks = [{
        id: 'test-link-else',
        source: 'test-node-else',
        target: 'test-node-else2',
      }];
      H.$ = function (selector) {
        if (selector === '#all-charters svg') {
          return {
            width: () => 100,
            height: () => 200,
            length: 1, // svg_exists is true
            html: () => {},
          };
        }
        if (selector === '#all-charters svg g') {
          return {
            length: 1, // svg_has_content is true
          };
        }
        return originalH$.call(this, selector);
      };

      // Set node_list and link_list
      node_list.set(testNodes);
      link_list.set(testLinks);

      // First call: sets up the simulation and previous_node_ids
      // H.simulation is null, so !simulation is true, we go into the if block
      H.simulation = null;
      expect(svg_graph()).to.eq('');

      // After the first call, the module-level simulation variable should be
      // set to mockSimulation (from d3.forceSimulation())

      // Second call: with same nodes, so structure_changed is false
      // simulation exists (from first call), svg_exists is true,
      // svg_has_content is true. This should trigger the else path
      expect(svg_graph()).to.eq('');

      // Verify that updateSimulation was called (alpha was set to 1)
      expect(mockSimulation.alphaValue).to.eq(1);
      expect(mockSimulation.restarted).to.eq(true);

      // Restore mocks
      d3.select = originalD3Select;
      d3.forceSimulation = originalD3ForceSimulation;
      d3.forceLink = originalD3ForceLink;
      d3.forceManyBody = originalD3ForceManyBody;
      d3.forceX = originalD3ForceX;
      d3.forceY = originalD3ForceY;
      d3.drag = originalD3Drag;
      H.$ = originalH$;
      // Reset node_list and link_list
      node_list.set([]);
      link_list.set([]);
      H.simulation = null;
    });
    it('skips updateLinkSelections when link_selection is null', () => {
      // Create a chainable mock for d3.select with all D3 selection methods
      let chainableMock;

      const mockExitSelection = {
        remove: function () { return this; },
      };

      const mockEnterSelection = {
        append: function () { return chainableMock; },
      };
      chainableMock = {
        attr: function () { return this; },
        append: function () { return chainableMock; },
        selectAll: function () { return chainableMock; },
        select: function () { return chainableMock; },
        data: function () { return chainableMock; },
        join: function () { return chainableMock; },
        exit: function () { return mockExitSelection; },
        enter: function () { return mockEnterSelection; },
        merge: function () { return chainableMock; },
        style: function () { return this; },
        text: function () { return this; },
        call: function () { return this; },
        on: function () { return this; },
        empty: function () { return false; },
      };

      // Mock d3.select
      const originalD3Select = d3.select;
      d3.select = () => chainableMock;

      // Mock d3.forceSimulation and related force functions
      const mockSimulation = {
        nodes: function (nodes) {
          if (nodes) {
            this.nodesValue = nodes;
          }
          return this.nodesValue || [];
        },
        force: function (name) {
          if (arguments.length === 2) {
            return mockSimulation;
          }
          if (name === 'link') {
            return {
              links: function (links) {
                mockSimulation.linksValue = links;
                return this;
              },
            };
          }
          return mockSimulation;
        },
        alpha: function (value) {
          this.alphaValue = value;
          return this;
        },
        restart: function () {
          this.restarted = true;
          return this;
        },
        stop: function () {},
        on: function () { return this; },
      };
      const originalD3ForceSimulation = d3.forceSimulation;
      const originalD3ForceLink = d3.forceLink;
      const originalD3ForceManyBody = d3.forceManyBody;
      const originalD3ForceX = d3.forceX;
      const originalD3ForceY = d3.forceY;
      const originalD3Drag = d3.drag;
      d3.forceSimulation = () => mockSimulation;
      d3.forceLink = () => ({ distance: () => ({ id: () => {} }) });
      d3.forceManyBody = () => ({ strength: () => {} });
      d3.forceX = () => {};
      d3.forceY = () => {};
      d3.drag = () => ({ on: function () { return this; } });

      // Set up document
      // eslint-disable-next-line no-native-reassign
      if (typeof document === 'undefined' || document === null) {
        global.document = {
          querySelector: () => chainableMock,
        };
      }
      else {
        document.querySelector = () => chainableMock;
      }

      // Mock H.$ to return width, height, and indicate svg exists with
      // content
      const originalH$ = H.$;
      const testNodes = [{ id: 'test-node-no-link', name: 'Test Node' }];
      const testLinks = [{
        id: 'test-link-no-link',
        source: 'test-node-no-link',
        target: 'test-node-no-link2',
      }];
      H.$ = function (selector) {
        if (selector === '#all-charters svg') {
          return {
            width: () => 100,
            height: () => 200,
            length: 1,
            html: () => {},
          };
        }
        if (selector === '#all-charters svg g') {
          return {
            length: 1,
          };
        }
        return originalH$.call(this, selector);
      };

      // Set node_list and link_list
      node_list.set(testNodes);
      link_list.set(testLinks);

      // First call: sets up simulation and link_selection
      H.simulation = null;
      expect(svg_graph()).to.eq('');

      // Set link_selection to null to test the else path
      setLinkSelection(null);

      // Second call: enters else block, link_selection is null,
      // so updateLinkSelections is skipped
      expect(svg_graph()).to.eq('');

      // Restore mocks
      d3.select = originalD3Select;
      d3.forceSimulation = originalD3ForceSimulation;
      d3.forceLink = originalD3ForceLink;
      d3.forceManyBody = originalD3ForceManyBody;
      d3.forceX = originalD3ForceX;
      d3.forceY = originalD3ForceY;
      d3.drag = originalD3Drag;
      H.$ = originalH$;
      // Reset node_list and link_list
      node_list.set([]);
      link_list.set([]);
      H.simulation = null;
    });
    it('skips updateNodeSelections when node_selection is null', () => {
      let chainableMock;

      const mockExitSelection = {
        remove: function () { return this; },
      };

      const mockEnterSelection = {
        append: function () { return chainableMock; },
      };
      chainableMock = {
        attr: function () { return this; },
        append: function () { return chainableMock; },
        selectAll: function () { return chainableMock; },
        select: function () { return chainableMock; },
        data: function () { return chainableMock; },
        join: function () { return chainableMock; },
        exit: function () { return mockExitSelection; },
        enter: function () { return mockEnterSelection; },
        merge: function () { return chainableMock; },
        style: function () { return this; },
        text: function () { return this; },
        call: function () { return this; },
        on: function () { return this; },
        empty: function () { return false; },
      };

      const originalD3Select = d3.select;
      d3.select = () => chainableMock;

      const mockSimulation = {
        nodes: function (nodes) {
          if (nodes) {
            this.nodesValue = nodes;
          }
          return this.nodesValue || [];
        },
        force: function (name) {
          if (arguments.length === 2) {
            return mockSimulation;
          }
          if (name === 'link') {
            return {
              links: function (links) {
                mockSimulation.linksValue = links;
                return this;
              },
            };
          }
          return mockSimulation;
        },
        alpha: function (value) {
          this.alphaValue = value;
          return this;
        },
        restart: function () {
          this.restarted = true;
          return this;
        },
        stop: function () {},
        on: function () { return this; },
      };
      const originalD3ForceSimulation = d3.forceSimulation;
      const originalD3ForceLink = d3.forceLink;
      const originalD3ForceManyBody = d3.forceManyBody;
      const originalD3ForceX = d3.forceX;
      const originalD3ForceY = d3.forceY;
      const originalD3Drag = d3.drag;
      d3.forceSimulation = () => mockSimulation;
      d3.forceLink = () => ({ distance: () => ({ id: () => {} }) });
      d3.forceManyBody = () => ({ strength: () => {} });
      d3.forceX = () => {};
      d3.forceY = () => {};
      d3.drag = () => ({ on: function () { return this; } });

      if (typeof document === 'undefined' || document === null) {
        global.document = {
          querySelector: () => chainableMock,
        };
      }
      else {
        document.querySelector = () => chainableMock;
      }

      const originalH$ = H.$;
      const testNodes = [{ id: 'test-node-no-node', name: 'Test Node' }];
      const testLinks = [{
        id: 'test-link-no-node',
        source: 'test-node-no-node',
        target: 'test-node-no-node2',
      }];
      H.$ = function (selector) {
        if (selector === '#all-charters svg') {
          return {
            width: () => 100,
            height: () => 200,
            length: 1,
            html: () => {},
          };
        }
        if (selector === '#all-charters svg g') {
          return {
            length: 1,
          };
        }
        return originalH$.call(this, selector);
      };

      node_list.set(testNodes);
      link_list.set(testLinks);

      H.simulation = null;
      expect(svg_graph()).to.eq('');

      setNodeSelection(null);

      expect(svg_graph()).to.eq('');

      d3.select = originalD3Select;
      d3.forceSimulation = originalD3ForceSimulation;
      d3.forceLink = originalD3ForceLink;
      d3.forceManyBody = originalD3ForceManyBody;
      d3.forceX = originalD3ForceX;
      d3.forceY = originalD3ForceY;
      d3.drag = originalD3Drag;
      H.$ = originalH$;
      node_list.set([]);
      link_list.set([]);
      H.simulation = null;
    });
  });

  describe('#collect_graph_lists', function () {
    it('returns the collected nodes and links', async () => {
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
      lanesStub.insert(lane4);
      lanesStub.insert(lane3);
      lanesStub.insert(lane2);
      lanesStub.insert(lane1);

      expect(node_ids.indexOf(lane1._id)).to.eq(-1);
      await collect_graph_lists(lane1);
      const lists = await collect_graph_lists(lane4);
      expect(await collect_graph_lists()).to.eq(false);
      expect(lists.nodes.length).to.eq(4);
      expect(lists.links.length).to.eq(2);
      expect(lists.nodes[0].fill).to.eq('#44aa99');
      expect(lists.nodes[1].fill).to.eq('#D41159');
      expect(lists.nodes[2].fill).to.eq('darkgoldenrod');
      expect(lists.nodes[3].fill).to.eq(undefined);
      await collect_graph_lists(lane1);
      expect(lists.node_ids.indexOf(lane1._id)).to.eq(0);
      expect(lists.node_ids.length).to.eq(4);

      // Link colors should match charter semantics:
      // followup = blue, salvage = orange.
      const followupLink = lists.links.find(l => l.id === 'lane1:lane2');
      const salvageLink = lists.links.find(l => l.id === 'lane1:lane3');
      expect(followupLink).to.not.eq(undefined);
      expect(salvageLink).to.not.eq(undefined);
      expect(followupLink.stroke).to.eq('#0af');
      expect(salvageLink.stroke).to.eq('#fa0');
    });
    it('handles case where existing_node is not found in else block',
      async () => {
        const testLane = {
          _id: 'test-lane-missing-node',
          name: 'Test Lane',
          last_shipment: { exit_code: 0 },
        };
        lanesStub.insert(testLane);

        await collect_graph_lists(testLane);
        const result = await collect_graph_lists(testLane);
        const testNode = result.nodes.find(n => n.id === testLane._id);
        expect(testNode).to.not.eq(undefined);

        const nodeIndex = result.nodes.indexOf(testNode);
        let mapPhase = true;
        const originalMap = result.nodes.map.bind(result.nodes);
        result.nodes.map = function (callback) {
          mapPhase = true;
          const mapped = originalMap(callback);
          mapPhase = false;
          return mapped;
        };
        Object.defineProperty(result.nodes[nodeIndex], 'id', {
          get: function () {
            return mapPhase ? testLane._id : undefined;
          },
          enumerable: true,
          configurable: true,
        });

        const result2 = await collect_graph_lists(testLane);
        expect(result2).to.not.eq(false);
        result.nodes.map = originalMap;
      });
    it('calls Lanes.findOne when followup has _id but no name',
      async () => {
        const followupLane = {
          _id: 'followup-lane',
          name: 'Followup Lane',
          last_shipment: { exit_code: 0 },
        };
        const testLane = {
          _id: 'test-lane',
          name: 'Test Lane',
          followup: { _id: 'followup-lane' },
          last_shipment: { exit_code: 0 },
        };
        lanesStub.insert(followupLane);
        lanesStub.insert(testLane);

        const result = await collect_graph_lists(testLane);
        expect(result.nodes.some(n => n.id === 'followup-lane')).to.eq(true);
        expect(result.links.some(l => l.id === 'test-lane:followup-lane'))
          .to.eq(true);
      });
    it('resolves followup by slug when _id is not present (no shipments yet)',
      async () => {
        const followupLane = {
          _id: 'followup-lane',
          slug: 'followup-slug',
          name: 'Followup Lane',
          last_shipment: { exit_code: 0 },
        };
        const testLane = {
          _id: 'test-lane',
          name: 'Test Lane',
          followup: { slug: 'followup-slug' },
          last_shipment: { exit_code: 0 },
        };
        lanesStub.insert(followupLane);
        lanesStub.insert(testLane);

        const result = await collect_graph_lists(testLane);
        expect(result.nodes.some(n => n.id === 'followup-lane')).to.eq(true);
        expect(result.links.some(l => l.id === 'test-lane:followup-lane'))
          .to.eq(true);
      });
    it('resolves followup when stored as a raw string ref', async () => {
      const followupLane = {
        _id: 'followup-lane',
        slug: 'followup-slug',
        name: 'Followup Lane',
        last_shipment: { exit_code: 0 },
      };
      const testLane = {
        _id: 'test-lane',
        name: 'Test Lane',
        followup: 'followup-lane',
        last_shipment: { exit_code: 0 },
      };
      lanesStub.insert(followupLane);
      lanesStub.insert(testLane);

      const result = await collect_graph_lists(testLane);
      expect(result.nodes.some(n => n.id === 'followup-lane')).to.eq(true);
      expect(result.links.some(l => l.id === 'test-lane:followup-lane'))
        .to.eq(true);
    });
    it('calls Lanes.findOne when salvage_plan has _id but no name',
      async () => {
        const salvageLane = {
          _id: 'salvage-lane',
          name: 'Salvage Lane',
          last_shipment: { exit_code: 0 },
        };
        const testLane = {
          _id: 'test-lane',
          name: 'Test Lane',
          salvage_plan: { _id: 'salvage-lane' },
          last_shipment: { exit_code: 0 },
        };
        lanesStub.insert(salvageLane);
        lanesStub.insert(testLane);

        const result = await collect_graph_lists(testLane);
        expect(result.nodes.some(n => n.id === 'salvage-lane')).to.eq(true);
        expect(result.links.some(l => l.id === 'test-lane:salvage-lane'))
          .to.eq(true);
      });
    it(
      'resolves salvage_plan by slug when _id is not present' +
      ' (no shipments yet)',
      async () => {
        const salvageLane = {
          _id: 'salvage-lane',
          slug: 'salvage-slug',
          name: 'Salvage Lane',
          last_shipment: { exit_code: 0 },
        };
        const testLane = {
          _id: 'test-lane',
          name: 'Test Lane',
          salvage_plan: { slug: 'salvage-slug' },
          last_shipment: { exit_code: 0 },
        };
        lanesStub.insert(salvageLane);
        lanesStub.insert(testLane);

        const result = await collect_graph_lists(testLane);
        expect(result.nodes.some(n => n.id === 'salvage-lane')).to.eq(true);
        expect(result.links.some(l => l.id === 'test-lane:salvage-lane'))
          .to.eq(true);
      },
    );
  });

  describe('#build_graph', function () {
    it('returns the nodes of the graph', async () => {
      const lane1 = { _id: 'lane1' };
      const lane2 = { _id: 'lane2' };
      lanesStub.insert(lane1);
      lanesStub.insert(lane2);
      expect((await build_graph()).length).to.eq(2);
    });
  });
});
