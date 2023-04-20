// import {
//   loading_lanes,
//   sort_by_header,
//   delete_lane,
//   duplicate_lane,
//   ready,
//   active,
//   can_ply,
//   current_state,
//   followup_name,
//   last_shipped,
//   latest_shipment,
//   salvage_plan_name,
//   total_captains,
//   total_stops,
//   lane_ids,
//   empty,
//   lanes,
// } from './lib';

describe('Lanes Page', function () {

  describe('#empty', function () {
    it('returns true if there are no lanes');
  });

  describe('#sort_by_shipped_date', function () {
    it('returns -1 if the first lane was shipped more recently');
    it('returns 1 if the second lane was shipped more recently');
    it('returns 0 if both lanes shipped at the same time');
  });

  describe('#sort_by_total_shipments', function () {
    it('returns -1 if the first lane has more shipments');
    it('returns 1 if the second lane has more shipments');
    it('returns 0 if each lane has the same number of shipments');
  });

  describe('#sort_by_total_salvage_runs', function () {
    it('returns -1 if the first lane has more failed shipments');
    it('returns 1 if the second lane has more failed shipments');
    it('returns 0 if both lanes have the same number of failed shipments');
  });

  describe('#lanes', function () {
    it('returns a list of lanes sorted by name');
    it('returns a list of lanes sorted by number of captains');
    it('returns a list of lanes sorted by type of lane');
    it('returns a list of lanes sorted by number of shipments');
    it('returns a list of lanes sorted by number of salvage runs');
    it('returns a list of lanes sorted by exit code state');
    it('returns a list of lanes sorted by name of followup lane');
    it('returns a list of lanes sorted by name of salvage lane');
    it('returns a list of lanes');
  });

  describe('#loading_lanes', function () {
    it('returns true if the Session is not tracking total_lanes');
    it('returns true if the current count of lanes is less than the total');
    it('returns false otherwise');
  });

  describe('#sort_lane_table_reverse', function () {
    it('returns true if the given value is already sorted not in reverse');
    it('returns false otherwise');
  });

  describe('#reverse_sort', function () {
    it('sets that the sort should be in reverse in Session');
    it('adds a class to the target of the event');
    it('returns the event given');
  });

  describe('#default_sort', function () {
    it('sets that the sort should be the default way');
    it('removes a class from the target of the event');
    it('returns the event given');
  });

  describe('#sort_by_header', function () {
    it('removes classes from sublings of the target element');
    it('adds a class to the target element');
    it('adds a reverse class to the target element if reversed');
    it('sets the sort value in the Session');
  });

  describe('#delete_lane', function () {
    it('confirms the lane should be deleted');
    it('deletes the lane and updates the Session total_lanes');
  });

  describe('#duplicate_lane', function () {
    it('confirms the lane should be duplicated');
    it('duplicates the lane and then navigates to that Edit Lane Page');
  });

  describe('#ready', function () {
    it('returns true when Lanes, LatestShipment subscriptions are ready');
    it('returns false otherwise');
  });

  describe('#active', function () {
    it('returns empty string if no sort is set');
    it('returns an active string if a sort it set');
    it('returns an active reverse string if sort and reverse are set');
  });

  describe('#can_ply', function () {
    it('returns true if the user is a harbormaster');
    it('returns true if the user is a captain of the lane');
    it('returns true if the user has a token for the lane');
    it('returns false otherwise');
  });

  describe('#current_state', function () {
    it('returns "active" if there are any active shipments on the lane');
    it('returns "error" if the last shipment has a non-0 exit code');
    it('returns "ready" if the last exit code was 0');
    it('returns "N/A" otherwise');
  });

  describe('#followup_name', function () {
    it('returns the name of the followup lane or an empty string');
  });

  describe('#last_shipped', function () {
    it('returns the last shipped date as a locale string or empty string');
  });

  describe('#latest_shipment', function () {
    it('returns the latest shipment for a lane or an empty string');
  });

  describe('#salvage_plan_name', function () {
    it('returns the name of the salvage plan or an empty string');
  });

  describe('#total_captains', function () {
    it('returns 0 if there are no captains');
    it('returns the number of captains assigned to a lane');
  });

  describe('#total_stops', function () {
    it('returns the total number of destinations the lane has');
  });

});
