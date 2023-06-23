import { Harbors } from "../../../api/harbors";
import { Users } from '../../../api/users';

let Constraints = new H.ReactiveVar({
  global: [],
  root: [],
  edit_lane: [],
  ship_lane: [],
  charter: [],
  users: [],
  profile: [],
  reset_password: [],
  lanes: [],
});

const is_loaded = function () {
  if (this.$subReady.Harbors && ! H.loggingIn()) return true;
  return false;
};

const no_users = function () {
  if (! Users.find().fetch().length) { return true; }
  return false;
};

const logged_in = function () {
  return H.user();
};

const no_harbormasters = function () {
  const harbormasters = Users.find({ harbormaster: true }).fetch();

  return ! harbormasters.length ? true : false;
};

const set_constraints = function () {
  const parsed = {};
  const { name } = this.$route;
  Harbors.find().forEach(harbor => {
    if (harbor.constraints) {
      for (const [scope, list] of Object.entries(harbor.constraints)) {
        parsed[scope] = parsed[scope] ? parsed[scope].concat(list) : list;
        if (scope == name && parsed[scope].length) {
          parsed[name].forEach(constraint => {
            if (is_valid_constraint(constraint) && constraint.rel) {
              return add_rel(constraint);
            }
            else if (is_valid_constraint(constraint)) {
              return add_script(constraint);
            }
          });
        }
      }
    }
  });

  Constraints.set(parsed);
};

const is_valid_constraint = function (constraint) {
  if (
    !constraint.id
    || (!constraint.rel && !constraint.src && !constraint.text)
  ) {
    throw new Error(`
      An 'id' string is required for all constraints,
      as well as either a 'src' field, a 'text' field, 
      or both a 'rel' and 'href' field.
    `);
  }
};

const add_script = function (constraint) {
  const script = H.window.document.createElement('script');
  script.async = constraint.async || false;
  script.id = constraint.id;
  if (constraint.src) script.src = constraint.src;
  else if (constraint.text) script.text = constraint.text;
  else throw new Error('A "src" or "text" field must be supplied!');
  H.window.document.body.appendChild(script);
  return script;
};

const add_rel = function (constraint) {
  const link = H.window.document.createElement('link');
  link.rel = constraint.rel;
  link.href = constraint.href;
  link.id = constraint.id;
  H.window.document.head.appendChild(link);
  return link;
};

export {
  is_loaded,
  no_harbormasters,
  no_users,
  logged_in,
  set_constraints,
  Constraints,
  is_valid_constraint,
  add_rel,
  add_script,
};

