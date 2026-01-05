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
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Harbors } from '..';
import { LatestShipment, Shipments } from '../../shipments';
import { Lanes } from '../../lanes';

const call_method = H.call;
const read_dir_sync = fs.readdirSync;
const stat_sync = fs.statSync;
const rm_sync = fs.rmSync;
const copy_sync = fse.copySync;
const update_avail_space = H.update_avail_space;
const scan_depot = H.scan_depot;

describe('Harbors', () => {
  beforeEach(async () => await resetDatabase());
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
      await Harbors.insertAsync({ _id: 'test' });
      await update_harbor({ _id: 'test', type: 'test' }, { test: true });
      expect(called).to.eq(true);
    });
    it("records the Harbor's updated manifest", async () => {
      H.call = async () => ({});
      H.harbors.test = { update: () => true };
      await Harbors.insertAsync({ _id: 'test' });
      await update_harbor({ _id: 'test', type: 'test' }, { test: true });
      expect((await Harbors.findOneAsync('test')).lanes.test.manifest.test)
        .to.eq(true);
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
      await Harbors.insertAsync({ _id: 'test' });
      await update_harbor(lane, { test: true });
      expect(called).to.eq(expected_method);
    });
    it("records if a Lane has no LatestShipment", async () => {
      expect(await LatestShipment.find().countAsync()).to.eq(0);
      H.call = async () => ({ rendered_work_preview: true });
      H.harbors.test = { update: () => true };
      await Harbors.insertAsync({ _id: 'test' });
      await update_harbor({ _id: 'test', type: 'test' }, { test: true });
      expect(await LatestShipment.find({}).countAsync()).to.eq(1);
    });
    it("returns the Lane which failed to update on failure", async () => {
      H.call = async () => ({});
      H.harbors.test = { update: () => false };
      await Harbors.insertAsync({ _id: 'test' });
      const results = await update_harbor(
        { _id: 'test', type: 'test' },
        { test: true },
      );
      expect(results.lane._id).to.eq('test');
    });
    it('throws on caught errors', async () => {
      H.harbors.test = { update: () => { throw new Error('test'); } };
      try {
        await update_harbor(
          { _id: 'test', type: 'test' },
          { test: true },
        );
      }
      catch (err) { expect(err.message).to.eq('test'); }
    });
    it('logs the error in non-test mode before rethrowing', async () => {
      const isTestOrig = H.isTest;
      const errOrig = console.error;
      let logged = false;
      try {
        H.isTest = false;
        console.error = () => { logged = true; };
        H.harbors.test = { update: () => { throw new Error('test'); } };
        await update_harbor(
          { _id: 'test', type: 'test' },
          { test: true },
        );
        throw new Error('expected throw');
      }
      catch (err) {
        expect(err.message).to.eq('test');
        expect(logged).to.eq(true);
      }
      finally {
        H.isTest = isTestOrig;
        console.error = errOrig;
      }
    });
  });
  describe('#render_input', () => {
    beforeEach(async () => {
      await resetDatabase();
      delete H.harbors.test;
    });

    it("doesn't render input for New lanes", async () => {
      const result = await render_input({ name: 'New' });
      expect(result).to.eq(404);
    });
    it("updates a Lane's rendered input and work preview", async () => {
      H.harbors.test = {
        render_work_preview: async () => true,
        render_input: () => true,
      };
      const lane = { _id: 'test', type: 'test' };
      await Lanes.insertAsync(lane);
      const found = await Lanes.findOneAsync({ _id: 'test' });
      expect(found).to.not.be.null;
      await render_input(lane);
      const updated = await Lanes.findOneAsync({ _id: 'test' });
      expect(updated).to.not.be.null;
      expect(updated.rendered_input)
        .to.eq(updated.rendered_work_preview)
        .to.eq(true);
    });
    it('returns 404 for any caught errors', async () => {
      const result = await render_input();
      expect(result).to.eq(404);
    });
    it('returns 404 when render_input throws an error', async () => {
      H.harbors.test = {
        render_input: () => { throw new Error('render_input failed'); },
        render_work_preview: async () => true,
      };
      const lane = { _id: 'test', type: 'test' };
      await Lanes.insertAsync(lane);
      const result = await render_input(lane);
      expect(result).to.eq(404);
      delete H.harbors.test;
    });
  });
  describe('#render_work_preview', () => {
    beforeEach(async () => await resetDatabase());

    it('returns 404 for an unknown harbor type', async () => {
      const result = await render_work_preview();
      expect(result).to.eq(404);
    });
    it('updates the rendered_work_preview for a Lane', async () => {
      H.harbors.test = { render_work_preview: async () => true };
      const lane = { _id: 'test', type: 'test' };
      await Lanes.insertAsync(lane);
      const found = await Lanes.findOneAsync({ _id: 'test' });
      expect(found).to.not.be.null;
      await render_work_preview(lane);
      const updated = await Lanes.findOneAsync({ _id: 'test' });
      expect(updated).to.not.be.null;
      expect(updated.rendered_work_preview).to.eq(true);
      delete H.harbors.test;
    });
    it("updates a historical Shipment's rendered work preview", async () => {
      H.harbors.test = { render_work_preview: async () => true };
      const lane = { _id: 'test', type: 'test' };
      await Lanes.insertAsync(lane);
      await Shipments.insertAsync({ _id: 'test' });
      await render_work_preview(lane, { shipment_id: 'test' });
      expect((await Shipments.findOneAsync('test')).rendered_work_preview)
        .to.eq(true);
      delete H.harbors.test;
    });
    it(
      'logs shipment update in non-test mode when shipment_id is present',
      async () => {
        const isTestOrig = H.isTest;
        const logOrig = console.log;
        const logs = [];
        try {
          H.isTest = false;
          console.log = (msg) => { logs.push(String(msg)); };
          H.harbors.test = { render_work_preview: async () => true };
          const lane = { _id: 'lane', type: 'test' };
          await Lanes.insertAsync(lane);
          await Shipments.insertAsync({ _id: 'ship' });
          await render_work_preview(lane, { shipment_id: 'ship' });
          expect(logs.join('\n')).to.include(
            'Updating rendered work for shipment',
          );
        }
        finally {
          H.isTest = isTestOrig;
          console.log = logOrig;
          delete H.harbors.test;
        }
      },
    );
    it('returns 404 for any caught errors', async () => {
      H.harbors.test = {
        render_work_preview: async () => { throw new Error(); },
      };
      const result = await render_work_preview({ type: 'test' });
      expect(result).to.eq(404);
    });
  });
  describe('#get_constraints', () => {
    it(
      "returns an object containing a Harbor's possible constraints",
      async () => {
        await resetDatabase();
        await Harbors.insertAsync({
          _id: 'test_harbor',
          constraints: {
            test: ['test_constraint'],
            global: ['global_constraint'],
          },
        });
        // Force materialization before calling the function under test
        await Harbors.find().fetchAsync();
        const constraints = await get_constraints('test');
        expect(constraints.test[0]).to.eq('test_constraint');
        expect(constraints.global[0]).to.eq('global_constraint');
      });
  });
  describe('#register', () => {
    let called;
    const harbor = { _id: 'test', registered: false };
    let originalReload;

    beforeEach(async () => {
      called = false;
      originalReload = H.reload;
      fs.readdirSync = () => ['test'];
      fs.statSync = () => ({ isDirectory: () => true });
      fs.rmSync = () => { };
      H.copySync = () => { };
      H.reload = () => { };
      await Harbors.insertAsync({ _id: 'test' });
    });
    afterEach(async () => {
      await resetDatabase();
      fs.readdirSync = read_dir_sync;
      fs.statSync = stat_sync;
      fs.rmSync = rm_sync;
      H.copySync = copy_sync;
      H.reload = originalReload;
      harbor.registered = false;
    });

    it("adds a registered harbor's files to the Harbors dir", async () => {
      H.copySync = () => called = true;
      await register(harbor);
      expect(called).to.eq(true);
      fs.statSync = () => ({ isDirectory: () => false });
      fs.readdirSync = () => {
        called = true;
        return ['test.js'];
      };
      called = false;
      harbor.registered = false;
      await register(harbor);
      expect(called).to.eq(true);
    });
    it(
      "removes an unregistered harbors' files from the Harbors dir",
      async () => {
        fs.rmSync = () => called = true;
        harbor.registered = true;
        await register(harbor);
        expect(called).to.eq(true);
      });
    it("reloads the application if files were modified", async () => {
      H.reload = () => called = true;
      await register(harbor);
      expect(called).to.eq(true);
      H.reload = originalReload;
    });
    it("returns 404 if no files were modified", async () => {
      fs.readdirSync = () => [];
      expect(await register(harbor)).to.eq(404);
    });
    it('logs added/removed files in non-test mode', async () => {
      const isTestOrig = H.isTest;
      const logOrig = console.log;
      const logs = [];
      try {
        H.isTest = false;
        console.log = (msg) => { logs.push(String(msg)); };

        // Register path: should log "Adding harbor ..."
        fs.readdirSync = () => ['test.js'];
        fs.statSync = () => ({ isDirectory: () => false });
        H.copySync = () => { };
        H.reload = () => { };
        harbor.registered = false;
        await register(harbor);
        expect(logs.join('\n')).to.include('Adding harbor');

        // Unregister path: should log "Removing recursively"
        logs.length = 0;
        fs.readdirSync = () => ['test.js'];
        fs.rmSync = () => { };
        harbor.registered = true;
        await register(harbor);
        expect(logs.join('\n')).to.include('Removing recursively');
      }
      finally {
        H.isTest = isTestOrig;
        console.log = logOrig;
      }
    });
  });
  describe('#remove', () => {
    let called;
    let harbor;
    beforeEach(async () => {
      harbor = { _id: 'test' };
      await Harbors.insertAsync(harbor);
      fs.rmSync = () => { };
      H.update_avail_space = () => { };
    });
    afterEach(() => {
      fs.rmSync = rm_sync;
      called = false;
    });

    it("removes a Harbor's files from the Depot", async () => {
      fs.rmSync = () => called = true;
      await remove(harbor);
      expect(called).to.eq(true);
    });
    it("updates the available space detected", async () => {
      H.update_avail_space = () => called = true;
      await remove(harbor);
      expect(called).to.eq(true);
      H.update_avail_space = update_avail_space;
    });
    it("throws with an invalid harbor object", async () => {
      let threw = false;
      try { await remove(); }
      // eslint-disable-next-line no-unused-vars
      catch (e) { threw = true; }
      expect(threw).to.eq(true);
    });
    it('logs removal progress in non-test mode', async () => {
      const isTestOrig = H.isTest;
      const logOrig = console.log;
      const logs = [];
      try {
        H.isTest = false;
        console.log = (msg) => { logs.push(String(msg)); };
        await remove(harbor);
        expect(logs.join('\n')).to.include('Removing');
        expect(logs.join('\n')).to.include('Successfully removed harbor');
      }
      finally {
        H.isTest = isTestOrig;
        console.log = logOrig;
      }
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
    });
    it("clones the git repo for a Harbor and scans for it", async () => {
      H.exec = async () => called = true;
      await add_harbor_to_depot(test_git_url);
      expect(called).to.eq(true);
    });
    it("handles any caught errors", async () => {
      H.exec = async () => { throw new Error('test'); };
      const result = await add_harbor_to_depot(test_git_url);
      expect(result.message).to.eq('test');
    });
    it("returns 200 if successful", async () => {
      const result = await add_harbor_to_depot(test_git_url);
      expect(result).to.eq(200);
    });
    it('logs stdout/stderr in non-test mode', async () => {
      const isTestOrig = H.isTest;
      const logOrig = console.log;
      const warnOrig = console.warn;
      const logs = [];
      const warns = [];
      try {
        H.isTest = false;
        console.log = (msg) => { logs.push(String(msg)); };
        console.warn = (msg) => { warns.push(String(msg)); };
        H.exec = async () => ({ stdout: 'OUT', stderr: 'ERR' });
        const result = await add_harbor_to_depot(test_git_url);
        expect(result).to.eq(200);
        expect(logs.join('\n')).to.include('OUT');
        expect(warns.join('\n')).to.include('ERR');
      }
      finally {
        H.isTest = isTestOrig;
        console.log = logOrig;
        console.warn = warnOrig;
      }
    });
  });
});
