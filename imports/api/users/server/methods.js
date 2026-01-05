import { Accounts } from 'meteor/accounts-base';
import { Users } from '..';
import { v4 as uuidv4 } from 'uuid';

export default {
  async 'Users#invite_user' (email, password) {
    if (! email) return false;

    const passwordProvided =
      (typeof password === 'string' && password.length > 0);

    // In Meteor 3.x this may be async.
    // `await` keeps this robust in app and tests.
    const user_account = await Accounts.findUserByEmail(email);
    const userAccountId = (typeof user_account === 'string') ?
      user_account :
      user_account?._id
      ;
    let user_record = await Users.findOneAsync(email);
    let createdAccountId;

    if (! user_account && ! user_record) {
      password = passwordProvided ? password : uuidv4();
      createdAccountId = await Accounts.createUserAsync({
        email,
        password,
      });

      await Users.insertAsync({ _id: email, emails: [{ address: email }] });
    }
    else if (userAccountId && passwordProvided) {
      await Accounts.setPasswordAsync(userAccountId, password);
    }

    if (userAccountId && !user_record) {
      await Users.upsertAsync(
        email,
        {
          $set: { emails: [{ address: email }] },
          $setOnInsert: { _id: email },
        },
      );
    }

    // Return the Meteor.users account _id (not the Users collection email _id)
    const accountId = userAccountId || createdAccountId;

    /* istanbul ignore next */
    // If the caller didn't provide a password, send a reset email so the user
    // can set their own. (Skipped in tests/e2e runs.)
    if (accountId && !passwordProvided && !H.isE2E && !H.isTest) {
      try {
        await Accounts.sendResetPasswordEmail(accountId);
      }
      catch (error) {
        // Meteor throws when MAIL_URL isn't configured
        console.warn(
          'Password reset email not sent (MAIL_URL not configured), error:',
          error,
        );
      }
    }

    // If we have an account ID, return it; otherwise fall back to email
    return { _id: accountId || email };
  },

  async 'Users#expire_user' (email) {
    let expired_password = uuidv4();
    const user = await Accounts.findUserByEmail(email);
    if (!user || !user._id) throw new Error('User not found');
    await Users.updateAsync(email, { $set: { expired: true } });

    await Accounts.setPasswordAsync(user._id, expired_password);

    return email;
  },

  async 'Users#update' (email, user) {
    if (user && Object.keys(user).length > 0) {
      await Users.updateAsync(email, { $set: user });
    }
    return true;
  },

  async 'Users#reset_password' (email) {
    const account = await Accounts.findUserByEmail(email);
    /* istanbul ignore next */
    if (!H.isTest && account && account._id) {
      try {
        await Accounts.sendResetPasswordEmail(account._id);
      }
      catch (error) {
        // Meteor 3.x throws errors when MAIL_URL isn't configured
        // Generate the token directly using Meteor's internal method
        console.log(
          error,
          '\n====== Password Reset Email (MAIL_URL not configured) ======',
        );
        console.log('To:', email);
        // Use Accounts.generateResetToken which creates the proper reset token
        // This is what sendResetPasswordEmail calls internally
        const token = await Accounts.generateResetToken(
          account._id,
          email,
          'reset',
        );

        // Generate the reset URL with the token
        const resetUrl = Accounts.urls.resetPassword(token);
        console.log('\nPassword Reset URL:');
        console.log(resetUrl);
        console.log(
          '\n============================================================\n',
        );
      }
    }

    return email;
  },
};
