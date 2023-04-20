// import {
//   update_harbor,
//   change_lane_name,
//   slug,
//   followup_lane,
//   salvage_plan_lane,
//   lanes,
//   lane,
//   lane_count,
//   shipment_history,
//   no_followup,
//   no_salvage,
//   choose_followup,
//   choose_salvage_plan,
//   captain_list,
//   harbors,
//   current_lane,
//   render_harbor,
//   validate_done,
//   chosen_followup,
//   chosen_salvage_plan,
//   submit_form,
//   change_followup_lane,
//   change_salvage_plan,
//   change_captains,
//   back_to_lanes,
//   choose_harbor_type,
//   get_lane_name,
//   plying,
//   lane_type,
//   not_found,
// } from './lib';

// import page from './edit_lane.vue';

// const {
//   methods: {
//     duration,
//     prevent_enter_key,
//     add_destination,
//     add_followup_lane,
//     add_salvage_plan,
//     new_lane,
//     duplicate_lane,
//   },
//   meteor: {
//     shipping_log_amount_shown,
//     choose_type,
//     validating_fields,
//     can_save,
//   }
// } = page;


describe('Edit Lane Page', function () {

  describe('#update_harbor', function () {
    it('collects the values from the form input objects with a timestamp');
    it('updates the saved record for the lane');
    it('alerts with invalid values');
    it('throws if it receives an error');
    it('records that the lane fields are no longer in validation');
    it('updates the view of the harbor');
    it('returns the updated lane');
  });

  describe('#update_lane', function () {
    it('saves the lane record with updated values');
    it('updates the Session record for the current lane');
    it('returns the response from the update');
  });

  describe('#change_lane_name', function () {
    it('updates the lane with the new name');
    it('sets the updated lane as the active lane in the Session');
    it('navigates to the edit path for the new lane');
  });

  describe('#slug', function () {
    it('updates a lane with a slug based on its name');
    it('returns the slug url');
    it('returns empty string if the lane has no name yet');
  });

  describe('#followup_lane', function () {
    it('returns false if the lane does not yet exist');
    it('returns the name of the associated followup lane');
    it('returns empty string if no followup exists');
  });

  describe('#salvage_plan_lane', function () {
    it('returns false if the lane does not yet exist');
    it('returns the name of the associated salvage plan lane');
    it('returns empty string if no salvage plan exists');
  });

  describe('#lanes', function () {
    it('returns a cursor of lanes sorted by name');
  });

  describe('#lane', function () {
    it('returns the active lane');
  });

  describe('#lane_count', function () {
    it('returns the number of shipments the lane has made');
  });

  describe('#shipment_history', function () {
    it('returns a cursor of the shipments a lane has made');
    it('limits the number of shipments shown to the number given');
    it('returns false if no lane is provided');
  });

  describe('#no_followup', function () {
    it('returns true if there are fewer than 2 lanes');
    it('returns the followup lane if it exists');
    it('returns the choose_followup Session state if it is truthy');
    it('returns false otherwise');
  });

  describe('#no_salvage', function () {
    it('returns true if there are fewer than 2 lanes');
    it('returns the salvage plan lane if it exists');
    it('returns the choose_salvage_plan Session state if it is truthy');
    it('returns false otherwise');
  });

  describe('#choose_followup', function () {
    it('returns the choose_followup session state if truthy');
    it('returns the followup lane if it exists');
  });

  describe('#choose_salvage_plan', function () {
    it('returns the choose_salvage_plan session state if truthy');
    it('returns the followup lane if it exists');
  });

  describe('#can_ply', function () {
    it('returns true if the user is a harbormaster');
    it('returns true if the user is a captain of the lane');
    it('returns false otherwise');
  });

  describe('#captain_list', function () {
    it('returns a list of users who can ply the lane');
  });

  describe('#plying', function () {
    it('returns true if the user is a harbormaster');
    it('returns true if the current user is a captain');
    it('returns false otherwise');
  });

  describe('#harbors', function () {
    it('returns a list of registered harbors');
  });

  describe('#current_lane', function () {
    it('returns the current lane from Session if found');
    it('returns the current lane from lookup if no Session lane found');
    it('returns an object matching { "type": false } if no lane found');
  });

  describe('#lane_type', function () {
    it('returns the lane type if it exists, otherwise undefined');
  });

  describe('#render_harbor', function () {
    it('returns false if unable to find a lane');
    it('renders input if a harbor manifest is found');
    it('renders not found text if the lane is not found');
    it('returns the rendered input for the lane if it exists');
    it('returns the rendered input associated with the harbor');
    it('returns loading text if no other text is ready');
  });

  describe('#validate_done', function () {
    it('returns true if the minimum has been completed for the lane');
  });

  describe('#chosen_followup', function () {
    it('returns true if the argument is the assigned followup');
  });

  describe('#chosen_salvage_plan', function () {
    it('returns true if the argument is the assigned salvage plan');
  });

  describe('#submit_form', function () {
    it('returns false if no lane can be found');
    it('sets a lane slug');
    it('Sets that the lane is validating its fields');
    it('updates and returns the lane if not new');
    it('returns the lane if new, or lacking name or type');
  });

  describe('#change_followup_lane', function () {
    it('assigns a new followup lane or null and returns the updated lane');
    it('returns the lane if no update is made');
  });

  describe('#change_salvage_plan', function () {
    it('assigns a new salvage plan lane or null and returns the updated lane');
    it('returns the lane if no update is made');
  });

  describe('#change_captains', function () {
    it('updates the list of captains based on the event data given');
    it('updates the lane with the updated captain list');
  });

  describe('#back_to_lanes', function () {
    it('clears the active lane in the Session');
    it('navigates to the Lanes Page');
  });

  describe('#choose_harbor_type', function () {
    it('returns false if no lane can be found');
    it('sets the lane type to the type given');
    it('updates the lane slug');
    it('updates the record and session with the new lane data');
    it('returns true if successful');
  });

  describe('#get_lane_name', function () {
    it('sets the active session lane');
    it('returns the lane name or "New"');
  });

});

