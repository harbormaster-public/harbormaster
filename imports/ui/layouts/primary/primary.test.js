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
import { resetDatabase } from 'cleaner';

describe('Primary Layout', () => {
  describe('#is_loaded', () => {
    const logging_in_method = H.loggingIn;
    const test_logging_in_method = () => false;
    it(
      'returns true if Harbors subscription is ready and not logging in',
      () => {
        H.loggingIn = test_logging_in_method;
        this.$subReady = { Harbors: false };
        expect(is_loaded()).to.eq(false);
        this.$subReady = { Harbors: true };
        expect(is_loaded()).to.eq(true);
        H.loggingIn = logging_in_method;
      });
  });

  describe('#no_users', () => {
    it('returns true if there are no Users found', () => {
      resetDatabase(null);
      expect(no_users()).to.eq(true);
    });
    it('returns false if there are Users', () => {
      Factory.create('user');
      expect(no_users()).to.eq(false);
      resetDatabase(null);
    });
  });

  describe('#logged_in', () => {
    it('returns the user data object', () => {
      const user_method = H.user;
      const test_user_method = () => ({});
      H.user = test_user_method;
      expect(typeof logged_in()).to.eq('object');
      H.user = user_method;
    });
  });

  describe('#no_harbormasters', () => {
    it('returns true if there are no harbormasters', () => {
      expect(no_harbormasters()).to.eq(true);
    });
    it('returns false otherwise', () => {
      Factory.create('user', { harbormaster: true });
      expect(no_harbormasters()).to.eq(false);
      resetDatabase(null);
    });
  });

  describe('#set_constraints', () => {
    const harbors_find_method = Harbors.find;
    const test_harbors_find_method = () => ([
      {
        constraints: {
           global: ['foo'],
           test: [{ id: 'bar', rel: 'bar' }],
          },
      },
      {
        constraints: {
           global: ['baz'],
           test: [{ id: 'qux', src: 'qux' }],
          },
      },
    ]);

    before(() => Harbors.find = test_harbors_find_method);
    after(() => Harbors.find = harbors_find_method);

    it('tracks the constraints set by a harbor', () => {
      for (const list of Object.values(Constraints.get())) {
        expect(list.length).to.eq(0);
      }
      this.$route = { name: 'test' };
      set_constraints();
      expect(Constraints.get().global.length).to.eq(2);
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
