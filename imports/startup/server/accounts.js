import { Users } from '../../api/users';

const SITE_NAME = 'Harbormaster';
const FROM = 'Harbormaster <noreply@harbormaster>';

const set_harbormaster = (user_id = H.user().emails[0].address) => {
  let harbormaster = Users.find().fetch().length ? false : true;
  let user = Users.findOne(user_id);
  harbormaster = user ? user.harbormaster : harbormaster;
  user_id = user ? user._id : user_id;

  Users.upsert(user_id, { harbormaster });
};

Accounts.onLogin(set_harbormaster);

Accounts.emailTemplates.siteName = SITE_NAME;
Accounts.emailTemplates.from = FROM;

Accounts.emailTemplates.resetPassword = {
  subject () { return 'Set Your Harbormaster Account Password'; },
  text (user, url) {
    let email = user.emails[0].address;
    return `Click this link to set the password for ${email}: ${url}`;
  },
};

export {
  set_harbormaster,
};
