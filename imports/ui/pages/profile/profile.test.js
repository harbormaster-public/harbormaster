import { expect } from 'chai';
import {
  get_user_id,
  handle_change_from_webhook,
  handle_change_can_ply,
  handle_change_is_harbormaster,
  user_email,
  is_harbormaster,
  not_harbormaster,
  is_captain,
  can_ply,
  can_change_plying,
  can_change_webhook,
  webhook_allowed,
  webhook_token,
} from './lib';
import { resetDatabase } from 'cleaner';
import { Lanes } from '../../../api/lanes';
const call_method = H.call;
const user_method = H.user;

describe('Profile Page', () => {

  describe('#get_user_id', function () {
    it('returns the user email address', () => {
      expect(get_user_id({
        $route: {
          params: {
            user_id: 'test@harbormaster.io',
          },
        },
      })).to.eq('test@harbormaster.io');
      expect(get_user_id()).to.eq('test@harbormaster.io');
    });
  });

  describe('#handle_change_from_webhook', function () {
    it('records whether or not it should remove a webhook token', () => {
      H.call = (method, lane_id, user_id, remove_token) => {
        expect(method).to.eq('Lanes#update_webhook_token');
        expect(user_id).to.not.eq(undefined);
        expect(typeof remove_token).to.eq('boolean');
      };
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      handle_change_from_webhook.bind(this)({ target: { checked: false } });
      H.call = call_method;
    });
    it('renders the lane list after it has completed', () => {
      H.call = (method, lane_id, user_id, remove_token, callback) => {
        callback();
      };
      this.lane_list_renders = 0;
      this.render_lane_list = () => this.lane_list_renders += 1;
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      handle_change_from_webhook.bind(this)({ target: { checked: false } });
      expect(this.lane_list_renders).to.eq(1);
      handle_change_from_webhook.bind(this)({ target: { checked: true } });
      expect(this.lane_list_renders).to.eq(2);
      H.call = call_method;
    });
  });

  describe('#handle_change_can_ply', function () {
    it('updates the list of captains for a lane based on event state', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('lane', {
        _id: 'test',
        captains: [],
      });
      let lane;
      let method;
      H.call = ($method, $lane) => {
        lane = $lane;
        method = $method;
      };
      handle_change_can_ply.bind(this)({ target: { checked: true } });
      expect(method).to.eq('Lanes#upsert');
      expect(lane.captains.length).to.eq(1);
      resetDatabase(null);
      Factory.create('lane', {
        _id: 'test',
        captains: undefined,
      });
      handle_change_can_ply.bind(this)({ target: { checked: false } });
      expect(Lanes.findOne('test').captains).to.eq(undefined);
      H.call = call_method;
    });
  });

  describe('#handle_change_is_harbormaster', function () {
    it('updates whether a user is a harbormaster', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', { _id: 'test@harbormaster.io' });
      H.call = (method, user_id, user) => {
        expect(method).to.eq('Users#update');
        expect(user.harbormaster).to.eq(true);
      };
      handle_change_is_harbormaster.bind(this)({ target: { checked: true } });
      H.call = call_method;
    });
  });

  describe('#user_email', function () {
    it('returns the user email or an empty string', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', { _id: 'test@harbormaster.io' });
      expect(user_email.bind(this)()).to.eq('test@harbormaster.io');
      resetDatabase(null);
      expect(user_email.bind(this)()).to.eq('');
    });
  });

  describe('#is_harbormaster', function () {
    it('returns true or an empty string', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(is_harbormaster.bind(this)()).to.eq(true);
      resetDatabase(null);
      expect(is_harbormaster.bind(this)()).to.eq('');
    });
  });

  describe('#not_harbormaster', function () {
    it('returns false if the user is a harbormaster', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(not_harbormaster.bind(this)()).to.eq(false);
    });
    it('returns true if the user is not a harbormaster', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: false,
      });
      expect(not_harbormaster.bind(this)()).to.eq(true);
    });
  });

  describe('#is_captain', function () {
    it('returns true if there are lanes captained by the user', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', { _id: 'test@harbormaster.io' });
      Factory.create('lane', {
        _id: 'test',
        captains: ['test@harbormaster.io'],
      });
      expect(is_captain.bind(this)()).to.eq(true);
    });
    it('returns false otherwise', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', { _id: 'test@harbormaster.io' });
      Factory.create('lane', { _id: 'test' });
      expect(is_captain.bind(this)()).to.eq(false);
    });
  });

  describe('#can_ply', function () {
    beforeEach(() => resetDatabase(null));

    it('returns true if the user is a harbormaster', () => {
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(can_ply.bind(this)()).to.eq(true);
    });
    it('returns true if the user is listed as a captain for the lane', () => {
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      expect(can_ply.bind(this)({ captains: ['test@harbormaster.io'] }))
        .to
        .eq(true)
      ;
    });
    it('returns false otherwise', () => {
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      expect(can_ply.bind(this)()).to.eq(false);
    });
  });

  describe('#can_change_plying', function () {
    beforeEach(() => resetDatabase(null));

    it('returns true if the current user is a harbormaster', () => {
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(can_change_plying.bind(this)()).to.eq(true);
    });
    it('returns false if the harbormaster viewed is different', () => {
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      H.user = () => ({ emails: [{ address: 'foo@bar.com' }] });
      Factory.create('user', { _id: 'foo@bar.com', harbormaster: true });
      Factory.create('user', { _id: 'test@harbormaster.io' });
      expect(can_change_plying.bind(this)()).to.eq(false);
      H.user = user_method;
    });
    it('returns true if no user is found', () => {
      this.$route = { params: { user_id: 'foo@harbormaster.io' } };
      expect(can_change_plying.bind(this)()).to.eq(true);
    });
    it('returns true if the user found is not a harbormaster', () => {
      Factory.create('user', { _id: 'foo@harbormaster.io' });
      this.$route = { params: { user_id: 'foo@harbormaster.io' } };
      expect(can_change_plying.bind(this)()).to.eq(true);
    });
    it('returns true if the user found is not a harbormaster', () => {
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', { _id: 'test@harbormaster.io' });
      expect(can_change_plying.bind(this)()).to.eq(true);
    });
  });

  describe('#can_change_webhook', function () {
    it('returns false if the user is a harbormaster', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      Factory.create('user', {
        _id: 'test@harbormaster.io',
        harbormaster: true,
      });
      expect(can_change_webhook.bind(this)()).to.eq(false);
    });
  });

  describe('#webhook_allowed', function () {
    it('returns false if the user has no tokens', () => {
      resetDatabase(null);
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      expect(webhook_allowed.bind(this)()).to.eq(false);
    });
    it(
      'returns the token associated with the user for the lane',
      () => {
        resetDatabase(null);
        this.$route = { params: { user_id: 'test@harbormaster.io' } };
        expect(webhook_allowed.bind(this)({
          tokens: {
            'test_token': 'test@harbormaster.io',
          },
        })).to.eq('test_token');
      });
  });

  describe('#webhook_token', () => {
    it('returns an empty string if the lane has no tokens', () => {
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      expect(webhook_token({})).to.eq('');
    });
    it('returns the token for a given user_id', () => {
      this.$route = { params: { user_id: 'test@harbormaster.io' } };
      expect(webhook_token({ tokens: { foo: 'test@harbormaster.io' } }))
        .to.eq('foo');
    });
  });

});
