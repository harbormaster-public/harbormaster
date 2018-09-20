import { Template } from 'meteor/templating';
import { Users } from '../../../api/users';

let Constraints = new ReactiveVar({});

Template.main.onCreated(function () {
  Meteor.subscribe('Users');
  Meteor.subscribe('Lanes');
  Meteor.subscribe('Harbors');
});

Template.main.onDestroyed(function () {
  for (let [key, value] of Object.entries(constraints)) {
    value.forEach((constraint) => $(`#${constraint.id}`)[0].remove());
  }
});

Template.main.helpers({
  is_loaded () {
    if (
      ! Session.get('loading')
      && ! Meteor.loggingIn()
    ) return true;

    return false;
  },

  logged_in () {
    return Meteor.user();
  },

  no_harbormasters () {
    var harbormasters = Users.find({ harbormaster: true }).fetch();

    return ! harbormasters.length ? true : false;
  },

  no_users () {
    if (! Users.find().fetch().length) { return true; }
    return false;
  },

  constraints () {
    const constraints = Constraints.get();
    for (let [key, value] of Object.entries(constraints)) {
      value.forEach((constraint) => {
        if (constraint.rel) {
          const link = document.createElement('link');
          link.rel = constraint.rel;
          link.href = constraint.href;
          link.id = constraint.id;
          document.head.appendChild(link);
          return link;
        }

        const script = document.createElement('script');
        script.async = constraint.async || false;
        script.id = constraint.id;
        if (constraint.src) script.src = constraint.src;
        else if (constraint.text) script.text = constraint.text;
        else throw new Error('A "src" or "text" field must be supplied!');
        document.body.appendChild(script);
        return script;
      });
    }
  },
});

export { Constraints };
