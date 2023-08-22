import {Users} from '../../imports/api/users';
import {cwd} from 'process';
import { Accounts } from 'meteor/accounts-base';
import {
  page,
} from 'meteor/universe:e2e';

export * from 'meteor/universe:e2e';

export {expect} from 'chai';

import $H from '../startup/config/namespace';

export const H = $H;

export const reset_users = Meteor.bindEnvironment(async () => {
  await Users.rawCollection().deleteMany({});
  await H.users.rawCollection().deleteMany({});

  return this;
});

export const create_test_user = Meteor.bindEnvironment(async (
    email,
    password,
    should_log,
  ) => {
  if (should_log) console.log(
    `Creating test user "${test_email}" with password "${test_password}"`
  );
  await Accounts.createUser({ email, password });
  Users.insert({ _id: email });

  return this;
});

export const test_user_login = async function (email, password, log = false) {
  await page.type('.login-form input[type="email"]', email);
  await page.type('.login-form input[type="password"]', password);
  await page.click('button.sign-in');

  try {
    await page.click('.acknowledge-new-harbormaster');
    if (log) console.log('New Harbormaster page acknowledged during login.');
  }
  catch (e) {
    if (log) console.log('Existing Harbormasters detected.');
  }
  finally {
    if (log) console.log(`Logged in with credentials:\n${email}\n${password}`);
  }
};

export const screenshot = async function (filename, title) {
  const type = 'png';
  const encoding = 'binary';
  const path = `${cwd()}/${filename}.${type}`;
  const fail_string = title ? `Test "${title}" failed.  ` : '';
  await page.screenshot({
    path,
    type,
    encoding,
  });

  console.log(`${fail_string}Saving screenshot:\n${path}`);

  return path;
};
