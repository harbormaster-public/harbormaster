// import {
  // lane,
  // work_preview,
  // active,
  // created,
  // exit_code,
  // shipment_history,
  // any_active,
  // reset_all_active,
  // reset_shipment,
  // has_work_output,
  // work_output,
  // duration,
  // pretty_date,
  // start_shipment,
  // handle_shipment_started,
// } from './lib';

describe('Ship Lane View', () => {
  describe('#lane', () => {
    it('returns the current lane by slug, or false');
  });

  describe('#active', () => {
    it('returns true if the current shipment is active, otherwise false');
  });

  describe('#created', () => {
    it('tracks a historical view');
    it('starts a shipment if user_id and token are given');
  });

  describe('#exit_code', () => {
    it('returns an empty string for a non-existant or active shipment');
    it('returns the exit code for a shipment by date');
  });

  describe('#work_preview', () => {
    it('returns not found text if no work is configured');
    it('returns the rendered work preview for a historical shipment');
    it('renders a work preview if none exist');
    it('upserts the lane and sets the Session on successful render');
    it('returns the currently configured work preview for a lane');
    it('returns not ready text if the lane requires configuration');
  });

  describe('#has_work_output', () => {
    it('returns true if the given shipment date has output or errors');
    it('returns true if there are any shipments even without stdout/err');
    it('returns false otherwise');
  });

  describe('#work_output', () => {
    it('returns the latest shipment for a lane');
  });

  describe('#shipment_history', () => {
    it('returns the list of shipments capped by H.AMOUNT_SHOWN');
  });

  describe('#pretty_date', () => {
    it('returns a locale string for a date passed');
    it('returns the never string for no date passed');
  });

  describe('#duration', () => {
    it('returns a human readable duration of how long a shipment took');
  });

  describe('#any_active', () => {
    it('returns true if any shipments are active for a lane');
  });

  describe('#reset_shipment', () => {
    it('resets an active shipment given a date and lane slug');
  });

  describe('#reset_all_active', () => {
    it('resets all active shipments for a lane');
  });

  describe('#start_shipment', () => {
    it('saves the working lane reference in the Session');
    it('starts a shipment for the lane');
    it('throws if it receives an error');
    it('sets the working lane to false in the Session when complete');
    it('navigates to the active shipment');
  });

});
