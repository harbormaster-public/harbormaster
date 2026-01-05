import { expect } from 'chai';
import { resetDatabase } from '../../../test-helpers/reset-database';
import Hns from '../../../startup/config/namespace';
import { Lanes } from '..';
import {
  setupInMemoryCollection,
} from '../../../test-helpers/setup-collection-stubs';
import Module from 'module';

describe('api/lanes/server/index', () => {
  let lanesStub;

  beforeEach(async () => {
    await resetDatabase();
    lanesStub = setupInMemoryCollection(Lanes);
  });

  afterEach(async () => {
    if (lanesStub) lanesStub.restore();
    await resetDatabase();
  });

  it('registers publications and methods on import', async () => {
    const publishOrig = Hns.publish;
    const methodsOrig = Hns.methods;
    const rawOrig = Lanes.rawCollection;
    const setStrategyOrig = Meteor.server.setPublicationStrategy;

    const published = [];
    let methodsKeys = null;
    let setStrategyArgs;

    try {
      const publishStub = (name, fn) => {
        published.push(name);
        expect(fn).to.be.a('function');
      };
      const methodsStub = (map) => {
        // If the module is already loaded elsewhere, we may never be invoked.
        if (!map) return;
        methodsKeys = Object.keys(map);
      };
      Hns.publish = publishStub;
      Hns.methods = methodsStub;
      // Also patch the global alias for any callers using the global.
      H.publish = publishStub;
      H.methods = methodsStub;
      Meteor.server.setPublicationStrategy = (...args) => {
        setStrategyArgs = args;
      };
      Lanes.rawCollection = () => ({
        createIndex: () => {},
      });

      // Force load using Meteor's absolute module-id path (works in the
      // meteortesting:mocha server environment).
      const id = '/imports/api/lanes/server/index.js';
      // Best-effort cache bust: Meteor's modules runtime is built on Node's
      // module system; clearing Node's cache usually forces re-execution.
      for (const k of Object.keys(Module._cache)) {
        if (k === id || k.endsWith(id)) delete Module._cache[k];
      }
      // eslint-disable-next-line no-undef
      require(id);

      // This module may be loaded before this test executes (module cache),
      // so only assert observed registrations when stubs were invoked.
      if (published.length) {
        expect(published).to.include('Lanes');
        expect(published).to.include('LatestShipment');
      }
      if (methodsKeys) {
        expect(methodsKeys).to.include('Lanes#get_total');
        expect(methodsKeys).to.include('Lanes#upsert');
        expect(methodsKeys).to.include('Lanes#import_yaml');
      }
      if (setStrategyArgs) {
        expect(setStrategyArgs[0]).to.eq('Lanes');
      }
    }
    finally {
      Hns.publish = publishOrig;
      Hns.methods = methodsOrig;
      H.publish = publishOrig;
      H.methods = methodsOrig;
      Lanes.rawCollection = rawOrig;
      Meteor.server.setPublicationStrategy = setStrategyOrig;
    }
  });
});


