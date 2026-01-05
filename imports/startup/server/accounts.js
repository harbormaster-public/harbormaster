import { Users } from '../../api/users';
import '../config/namespace.server';

const SITE_NAME = 'Harbormaster';
const FROM = 'Harbormaster <noreply@harbormaster>';

// Restore pre-Meteor 3.x behavior: log emails to console without MAIL_URL
// This allows local development without requiring a mail server
export const ensureEmailAvailable = () => {
  if (!H.Email || typeof H.Email.send !== 'function') {
    throw new Error(
      'H.Email is not available on the server ' +
      '(namespace.server.js not loaded?)',
    );
  }
};

ensureEmailAvailable();
const originalSend = H.Email.send;
H.Email.send = function (options) {
  /* istanbul ignore else */
  if (!process.env.MAIL_URL) {
    console.log('\n====== Email would have been sent ======');
    console.log('From:', options.from);
    console.log('To:', options.to);
    console.log('Subject:', options.subject);
    if (options.html) {
      console.log('HTML:', options.html);
    }
    else {
      console.log('Text:', options.text);
    }
    console.log('========================================\n');
    return; // Simulate successful send
  }
  originalSend.call(this, options);
};

const set_harbormaster = async (login) => {
  let user_id = login?.user?.emails[0]?.address ?
    login.user.emails[0].address :
    (await H.users.findOneAsync()).emails[0].address
    ;
  const isFirstUser = await Users.find().countAsync() === 0;
  let user = await Users.findOneAsync(user_id);

  let harbormaster = user?.harbormaster !== undefined ?
    user.harbormaster :
    isFirstUser
    ;
  await Users.upsertAsync(user_id, { $set: { harbormaster } });
};

Accounts.onLogin(set_harbormaster);

// Configure URLs for password reset (without hash, for history mode routing)
Accounts.urls.resetPassword = (token) => {
  return Meteor.absoluteUrl(`reset-password/${token}`);
};

Accounts.emailTemplates.siteName = SITE_NAME;
Accounts.emailTemplates.from = FROM;

/* istanbul ignore next reason: no meaningful logic below */
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
