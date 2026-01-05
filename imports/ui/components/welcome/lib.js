import { Accounts } from 'meteor/accounts-base';
import H from '../../../startup/config/namespace';

const reset_token = function () {
  return H.Session.get('password_reset_token');
};

const password_login = function () {
  const { email, password } = this;
  H.loginWithPassword(email, password, (err) => {
    if (err?.error == 403) {
      const invalid_msg = 'Invalid credentials.';
      console.error(invalid_msg);
      H.alert(invalid_msg);
    }
    else if (err) throw err;
  });
};

const password_reset = function () {
  const { email } = this;
  const no_email_alert = 'An email must be provided for a password reset';
  if (!email) {
    H.alert(no_email_alert);
    return;
  }
  this.reset = true;
  H.call('Users#reset_password', email, (err) => { if (err) throw err; });
};

const set_new_password = (() => function () {
  Accounts.resetPassword(
    reset_token(),
    this.password,
    (err) => { if (err) throw err; },
  );
  H.Session.set('password_reset_token', undefined);
  this.reset = false;
})();

export {
  reset_token,
  password_login,
  password_reset,
  set_new_password,
};


