import { expect } from 'chai';
import {
  is_loaded,
  no_harbormasters,
  no_users,
  logged_in,
  set_constraints,
  Constraints,
  is_valid_constraint,
  add_rel,
  add_script,
} from './lib';
import { Harbors } from '../../../api/harbors';
import { resetDatabase } from '../../../test-helpers/reset-database';
import { Users } from '../../../api/users';
import {
  setupInMemoryCollection,
} from '../../../test-helpers/setup-collection-stubs';

describe('Primary Layout', () => {
  let usersStub;
  let harborsStub;

  beforeEach(async () => {
    await resetDatabase();
    usersStub = setupInMemoryCollection(Users);
    harborsStub = setupInMemoryCollection(Harbors);
  });

  afterEach(async () => {
    await resetDatabase();
    if (usersStub) usersStub.restore();
    if (harborsStub) harborsStub.restore();
  });
  describe('#is_loaded', () => {
    const logging_in_method = H.loggingIn;
    const test_logging_in_method = () => false;
    it(
      'returns true if Harbors subscription is ready and not logging in',
      () => {
        H.loggingIn = test_logging_in_method;
        expect(is_loaded()).to.eq(true);
        H.loggingIn = logging_in_method;
      });
  });

  describe('#no_users', () => {
    it('returns true if there are no Users found', () => {
      expect(no_users()).to.eq(true);
    });

    it('returns false if there are Users', () => {
      usersStub.insert({ _id: 'test' });
      expect(no_users()).to.eq(false);
    });
  });

  describe('#logged_in', () => {
    it('returns the user data object', () => {
      expect(typeof logged_in()).to.eq('object');
    });
  });

  describe('#no_harbormasters', () => {
    it('returns true if there are no harbormasters', async () => {
      expect(await no_harbormasters()).to.eq(true);
    });

    it('returns false otherwise', async () => {
      usersStub.insert({ _id: 'test', harbormaster: true });
      expect(await no_harbormasters()).to.eq(false);
    });
  });

  describe('#set_constraints', () => {
    beforeEach(() => {
      harborsStub.insert({
        constraints: {
          global: ['foo'],
          test: [{ id: 'bar', rel: 'bar' }],
        },
      });
      harborsStub.insert({
        constraints: {
          global: ['baz'],
          test: [{ id: 'qux', src: 'qux' }],
        },
      });
    });

    it('tracks the constraints set by a harbor', () => {
      for (const list of Object.values(Constraints.get())) {
        expect(list.length).to.eq(0);
      }
      set_constraints.call({ $route: { name: 'test' } });
      expect(Constraints.get().global.length).to.eq(2);
    });

    it('adds rel and script tags for route-scoped constraints', () => {
      const origHeadAppend = H.window.document.head.appendChild;
      const origBodyAppend = H.window.document.body.appendChild;
      let headCalls = 0;
      let bodyCalls = 0;
      H.window.document.head.appendChild = () => { headCalls += 1; };
      H.window.document.body.appendChild = () => { bodyCalls += 1; };
      try {
        set_constraints.call({ $route: { name: 'test' } });
        expect(headCalls).to.be.greaterThan(0);
        expect(bodyCalls).to.be.greaterThan(0);
      }
      finally {
        H.window.document.head.appendChild = origHeadAppend;
        H.window.document.body.appendChild = origBodyAppend;
      }
    });

    it('adds tags when using H.Router.currentRoute as route source', () => {
      const origHeadAppend = H.window.document.head.appendChild;
      const origBodyAppend = H.window.document.body.appendChild;
      const originalRoute = (H.Router || {}).currentRoute;
      let headCalls = 0;
      let bodyCalls = 0;
      H.window.document.head.appendChild = () => { headCalls += 1; };
      H.window.document.body.appendChild = () => { bodyCalls += 1; };
      H.Router = H.Router || {};
      try {
        H.Router.currentRoute = { name: 'test' };
        set_constraints();
        expect(headCalls).to.be.greaterThan(0);
        expect(bodyCalls).to.be.greaterThan(0);
      }
      finally {
        H.window.document.head.appendChild = origHeadAppend;
        H.window.document.body.appendChild = origBodyAppend;
        if (H.Router) H.Router.currentRoute = originalRoute;
      }
    });
  });

  describe('#is_valid_constraint', () => {
    it('returns false for an invalid constraint', () => {
      const id = 'test_id';
      const rel = 'test_rel';
      const src = 'test_src';
      const text = 'test_text';
      expect(is_valid_constraint({})).to.eq(false);
      expect(is_valid_constraint({ id })).to.eq(false);
      expect(is_valid_constraint({ id, rel })).to.eq(true);
      expect(is_valid_constraint({ id, src })).to.eq(true);
      expect(is_valid_constraint({ id, text })).to.eq(true);
    });
  });

  describe('#add_script', () => {
    let called = false;
    const test_body_append_child = () => called = true;
    const append_child_method = H.window.document.body.appendChild;

    before(() => H.window.document.body.appendChild = test_body_append_child);
    after(() => H.window.document.body.appendChild = append_child_method);

    it('creates a script tag and adds it to the document body', () => {
      add_script({ id: 'test', src: 'test' });
      expect(called).to.eq(true);
    });
    it('throws if it lacks a src or text property', () => {
      expect(() => add_script({ id: 'test' })).to.throw();
      expect(() => add_script({ id: 'test', src: 'test' })).to.not.throw();
      expect(() => add_script({ id: 'test', text: 'test' })).to.not.throw();
    });
    it('returns the script created', () => {
      const script = add_script({ id: 'test', src: 'test' });
      expect(script.id).to.eq('test');
      expect(script.src).to.eq('test');
      expect(script.async).to.eq(false);
    });
  });

  describe('#add_rel', () => {
    let called = false;
    const test_head_append_child = () => called = true;
    const append_child_method = H.window.document.head.appendChild;

    before(() => H.window.document.head.appendChild = test_head_append_child);
    after(() => H.window.document.head.appendChild = append_child_method);

    it('creates a link tag and adds it to the document head', () => {
      add_rel({});
      expect(called).to.eq(true);
    });
    it('returns the link created', () => {
      const link = add_rel({ id: 'test' });
      expect(link.id).to.eq('test');
    });
  });
});
