import { Users } from '../../../api/users';
// import { Constraints } from './helpers';

  const is_loaded = function () {
    if (!Session.get('loading') && ! H.loggingIn()) {
      return true;
    }
    return false;
  }

  const no_users = function () {
    if (! Users.find().fetch().length) { return true; }
    return false;
  }

  const logged_in = function () {
    return H.user();
  }

  const no_harbormasters = function () {
    const harbormasters = Users.find({ harbormaster: true }).fetch();

    return ! harbormasters.length ? true : false;
  }

  // Not yet implemented
  // constraints () {
  //   const constraints = Constraints.get();
  //   for (let [key, value] of Object.entries(constraints)) {
  //     value.forEach((constraint) => {
  //       if (constraint.rel) {
  //         const link = document.createElement('link');
  //         link.rel = constraint.rel;
  //         link.href = constraint.href;
  //         link.id = constraint.id;
  //         document.head.appendChild(link);
  //         return link;
  //       }

  //       const script = document.createElement('script');
  //       script.async = constraint.async || false;
  //       script.id = constraint.id;
  //       if (constraint.src) script.src = constraint.src;
  //       else if (constraint.text) script.text = constraint.text;
  //       else throw new Error('A "src" or "text" field must be supplied!');
  //       document.body.appendChild(script);
  //       return script;
  //     });
  //   }
  // },

export {
  is_loaded,
  no_harbormasters,
  no_users,
  logged_in,
}