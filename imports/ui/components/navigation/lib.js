import { Accounts } from 'meteor/accounts-base';

const handle_click_logout = function () {
  Accounts.logout((err) => { if (err) throw err; });
};

const handle_click_lanes = function () {
  H.Session.set('choose_followup', false);
  H.Session.set('choose_salvage_plan', false);
};

export {
  handle_click_logout,
  handle_click_lanes,
};


