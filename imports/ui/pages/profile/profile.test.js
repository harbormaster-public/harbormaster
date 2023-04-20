// import {
//   handle_change_from_webhook,
//   handle_change_can_ply,
//   handle_change_is_harbormaster,
//   user_email,
//   is_harbormaster,
//   not_harbormaster,
//   is_captain,
//   can_ply,
//   can_change_plying,
//   can_change_webhook,
//   webhook_allowed,
//   webhook_token,
// } from './lib';

describe('Profile Page', () => {

  describe('#get_user_id', function () {
    it('returns the user email address');
  });

  describe('#handle_change_from_webhook', function () {
    it('records whether or not it should remove a webhook token');
    it('renders the lane list after it has completed');
  });

  describe('#handle_change_can_ply', function () {
    it('returns a list of captains without the current user');
    it('updates the lane with the list of captains');
  });

  describe('#handle_change_is_harbormaster', function () {
    it('updates whether a user is a harbormaster');
    it('returns the updated user object');
  });

  describe('#user_email', function () {
    it('returns the user email or an empty string');
  });

  describe('#is_harbormaster', function () {
    it('returns true or an empty string');
  });

  describe('#not_harbormaster', function () {
    it('returns false if the user is a harbormaster');
    it('returns true if the user is not a harbormaster');
  });

  describe('#is_captain', function () {
    it('returns true if there are lanes captained by the user');
    it('returns false otherwise');
  });

  describe('#can_ply', function () {
    it('returns true if the user is a harbormaster');
    it('returns true if the user is listed as a captain for the lane');
    it('returns false otherwise');
  });

  describe('#can_change_plying', function () {
    it('returns true if the current user is a harbormaster');
    it('returns false if the user viewed is a different harbormaster');
    it('returns true if no user is found');
    it('returns true if the user found is not a harbormaster');
  });

  describe('#can_change_webhook', function () {
    it('returns true if the user can change webhook tokens');
  });

  describe('#webhook_allowed', function () {
    it('returns an empty string if the user has no tokens');
    it('returns a list of the token associated with the user for a lane');
  });

});
