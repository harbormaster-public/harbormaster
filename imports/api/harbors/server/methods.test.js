import fs from 'fs';
import fse from 'fs-extra';
import { expect } from 'chai';
import {
  update_harbor,
  render_input,
  render_work_preview,
  get_constraints,
  register,
  remove,
  add_harbor_to_depot,
} from './methods';
import { resetDatabase } from 'cleaner';
import { Harbors } from '..';
import { LatestShipment, Shipments } from '../../shipments';
import { Lanes } from '../../lanes';

const call_method = H.call;
const read_dir_sync = fs.readdirSync;
const stat_sync = fs.statSync;
const rm_sync = fs.rmSync;
const copy_sync = fse.copySync;
const reload = H.reload;
const update_avail_space = H.update_avail_space;
const scan_depot = H.scan_depot;

describe('Harbors', () => {
  beforeEach(() => resetDatabase(null));
  afterEach(() => {
    H.call = call_method;
  });

  describe('#update_harbor', () => {
    it("calls a registered Harbor's update() method", async () => {
      H.call = async () => ({});
      let called = false;
      H.harbors.test = {
        update () {
          called = true;
          return false;
        },
      };
      Factory.create('harbor', { _id: 'test' });
      await update_harbor({ _id: 'test', type: 'test' }, { test: true });
      expect(called).to.eq(true);
    });
    it("records the Harbor's updated manifest", async () => {
      H.call = async () => ({});
      H.harbors.test = { update: () => true };
      Factory.create('harbor', { _id: 'test' });
      await update_harbor({ _id: 'test', type: 'test' }, { test: true });
      expect(Harbors.findOne('test').lanes.test.manifest.test).to.eq(true);
    });
    it("updates a lane's work preview", async () => {
      const expected_method = 'Harbors#render_work_preview';
      let called;
      const lane = { _id: 'test', type: 'test' };
      H.harbors.test = { update: () => true };
      H.call = async (method) => {
        called = method;
        return lane;
      };
      Factory.create('harbor', { _id: 'test' });
      await update_harbor(lane, { test: true });
      expect(called).to.eq(expected_method);
    });
    it("records if a Lane has no LatestShipment", async () => {
      expect(LatestShipment.find().count()).to.eq(0);
      H.call = async () => ({ rendered_work_preview: true });
      H.harbors.test = { update: () => true };
      Factory.create('harbor', { _id: 'test' });
      await update_harbor({ _id: 'test', type: 'test' }, { test: true });
      expect(LatestShipment.find().count()).to.eq(1);
    });
    it("returns the Lane which failed to update on failure", async () => {
      H.call = async () => ({});
      H.harbors.test = { update: () => false };
      Factory.create('harbor', { _id: 'test' });
      const results = await update_harbor(
        { _id: 'test', type: 'test' },
        { test: true }
      );
      expect(results.lane._id).to.eq('test');
    });
    it('throws on caught errors', async () => {
      H.harbors.test = { update: () => { throw new Error('test'); } };
      try {
        await update_harbor(
          { _id: 'test', type: 'test' },
          { test: true }
        );
      }
      catch (err) { expect(err.message).to.eq('test'); }
    });
  });
  describe('#render_input', () => {
    beforeEach(() => {
      resetDatabase(null);
      delete H.harbors.test;
    });

    it("doesn't render input for New lanes", async () => {
      const result = await render_input({ name: 'New' });
      expect(result).to.eq(false);
    });
    it("updates a Lane's rendered input and work preview", async () => {
      H.harbors.test = {
        render_work_preview: async () => true,
        render_input: () => true,
      };
      const lane = Factory.create('lane', { _id: 'test', type: 'test' });
      await render_input(lane);
      expect(Lanes.findOne('test').rendered_input)
        .to.eq(Lanes.findOne('test').rendered_work_preview)
        .to.eq(true);
    });
    it('returns 404 for any caught errors', async () => {
      const result = await render_input();
      expect(result).to.eq(404);
    });
  });
  describe('#render_work_preview', () => {
    beforeEach(() => resetDatabase(null));

    it('returns 404 for an unknown harbor type', async () => {
      const result = await render_work_preview();
      expect(result).to.eq(404);
    });
    it('updates the rendered_work_preview for a Lane', async () => {
      H.harbors.test = { render_work_preview: async () => true };
      const lane = Factory.create('lane', { _id: 'test', type: 'test' });
      await render_work_preview(lane);
      expect(Lanes.findOne('test').rendered_work_preview).to.eq(true);
      delete H.harbors.test;
    });
    it("updates a historical Shipment's rendered work preview", async () => {
      H.harbors.test = { render_work_preview: async () => true };
      const lane = Factory.create('lane', { _id: 'test', type: 'test' });
      Factory.create('shipment', { _id: 'test' });
      await render_work_preview(lane, { shipment_id: 'test' });
      expect(Shipments.findOne('test').rendered_work_preview).to.eq(true);
      delete H.harbors.test;
    });
    it('returns 404 for any caught errors', async () => {
      H.harbors.test = {
        render_work_preview: async () => { throw new Error(); },
      };
      const result = await render_work_preview({ type: 'test' });
      expect(result).to.eq(404);
    });
  });
  describe('#get_constraints', () => {
    it("returns an object containing a Harbor's possible constraints", () => {
      Factory.create('harbor', { constraints: { test: 'test_constraint' } });
      expect(get_constraints('test').test[0]).to.eq('test_constraint');
    });
  });
  describe('#register', () => {
    let called;
    const harbor = { _id: 'test', registered: false };

    beforeEach(() => {
      called = false;
      fs.readdirSync = () => ['test'];
      fs.statSync = () => ({ isDirectory: () => true });
      fs.rmSync = () => { };
      H.copySync = () => { };
      H.reload = () => { };
      Factory.create('harbor', { _id: 'test' });
    });
    afterEach(() => {
      resetDatabase(null);
      fs.readdirSync = read_dir_sync;
      fs.statSync = stat_sync;
      fs.rmSync = rm_sync;
      H.copySync = copy_sync;
      harbor.registered = false;
    });

    it("adds a registered harbor's files to the Harbors dir", () => {
      H.copySync = () => called = true;
      register(harbor);
      expect(called).to.eq(true);
    });
    it("removes an unregistered harbors' files from the Harbors dir", () => {
      fs.rmSync = () => called = true;
      harbor.registered = true;
      register(harbor);
      expect(called).to.eq(true);
    });
    it("reloads the application if files were modified", () => {
      H.reload = () => called = true;
      register(harbor);
      expect(called).to.eq(true);
      H.reload = reload;
    });
    it("returns 404 if no files were modified", () => {
      fs.readdirSync = () => [];
      expect(register(harbor)).to.eq(404);
    });
  });
  describe('#remove', () => {
    let called;
    let harbor;
    beforeEach(() => {
      harbor = Factory.create('harbor', { _id: 'test' });
      fs.rmSync = () => { };
      H.update_avail_space = () => { };
    });
    afterEach(() => {
      fs.rmSync = rm_sync;
      called = false;
    });

    it("removes a Harbor's files from the Depot", () => {
      fs.rmSync = () => called = true;
      remove(harbor);
      expect(called).to.eq(true);
    });
    it("updates the available space detected", () => {
      H.update_avail_space = () => called = true;
      remove(harbor);
      expect(called).to.eq(true);
      H.update_avail_space = update_avail_space;
    });
  });
  describe('#add_harbor_to_depot', () => {
    let called;
    const test_git_url = 'https://github.com/strictlyskyler/harbormaster.git';

    beforeEach(() => {
      called = false;
      H.exec = async () => ({ stdout: '', stderr: '' });
      H.scan_depot = () => { };
    });
    afterEach(() => {
      H.scan_depot = scan_depot;
    });

    it("accepts only valid git urls", async () => {
      const result = await add_harbor_to_depot('foo');
      expect(result).to.eq(400);
      // H.scan_depot = scan_depot;
    });
    it("clones the git repo for a Harbor and scans for it", async () => {
      H.exec = async () => called = true;
      await add_harbor_to_depot(test_git_url);
      expect(called).to.eq(true);
      H.scan_depot = scan_depot;
    });
    it("handles any caught errors", async () => {
      H.exec = async () => { throw new Error('test'); };
      const result = await add_harbor_to_depot(test_git_url);
      expect(result.message).to.eq('test');
      H.scan_depot = scan_depot;
    });
    it("returns 200 if successful", async () => {
      const result = await add_harbor_to_depot(test_git_url);
      expect(result).to.eq(200);
      H.scan_depot = scan_depot;
    });
  });
});
