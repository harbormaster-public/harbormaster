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

describe('Main Layout', () => {
  describe('#is_loaded', () => {
    it('returns true if Harbors subscription is ready and not logging in');
  });

  describe('#no_users', () => {
    it('returns true if there are no Users found');
  });

  describe('#logged_in', () => {
    it('returns the user data object');
  });

  describe('#no_harbormasters', () => {
    it('returns true if there are no harbormasters');
  });

  describe('#set_constraints', () => {
    it('tracks the constraints set by a harbor');
    it('returns the links and scripts for the constraints');
  });

  describe('#is_valid_constraint', () => {
    it('throws for an invalid constraint');
  });

  describe('#add_script', () => {
    it('creates a script tag and adds it to the document body');
    it('throws if it lacks a src or text property');
    it('returns the script created');
  });

  describe('#add_rel', () => {
    it('creates a link tag and adds it to the document head');
    it('returns the link created');
  });
});
