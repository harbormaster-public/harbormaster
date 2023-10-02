import faker from 'faker';

const test_email = faker.internet.email();
const test_password = faker.internet.password();

import {
  describe,
  it,
  before,
  beforeEach,
  page,
  reset_users,
  create_test_user,
  test_user_login,
  H,
  expect,
} from '../../helpers';

describe('Routes', function () {
  before(async () => {
    await reset_users();
  });

  beforeEach(async function () {
    await page.goto(H.absoluteUrl());
    let header = await page.waitForSelector('h1', { visible: true });

    expect(header).to.exist;
  });

  describe('when there are no users', function () {

    beforeEach(async () => {
      await reset_users();
    });

    it('show the Welcome Page', async function () {
      const new_instance_form = await page.waitForSelector('#new-instance', {
        visible: true,
      });

      expect(new_instance_form).to.exist;
    });

    it('allow a new user to sign up', async () => {
      await page.type('.email-user-invite', test_email);
      await page.click('.initial-sign-in');
      const login_form = await page.waitForSelector('.login-form', {
        visible: true,
      });

      expect(login_form).to.exist;
    });
  });

  describe('when there are users', () => {
    before(async () => {
      await reset_users();
      await create_test_user(test_email, test_password);
    });

    it('allow users to login and logout', async () => {
      await test_user_login(test_email, test_password);
      const root_page = await page.waitForSelector('#root-page');

      expect(root_page).to.not.be.null;

      await page.click('.logout');
      const login_form = await page.waitForSelector('.login-form', {
        visible: true,
      });

      expect(login_form).to.exist;
    });

    it('allow a user to reset a password', async () => {
      await page.type('.login-form input[type="email"]', test_email);
      await page.click('.forgot-password');
      const instructions = await page.waitForSelector('.instructions', {
        visible: true,
      });

      expect(instructions).to.exist;
    });
  });

  describe('for logged in users', () => {
    const users_url = `${H.absoluteUrl()}users`;

    before(async () => {
      await reset_users();
      await create_test_user(test_email, test_password);
      await page.goto(H.absoluteUrl());
      await page.reload();
      await test_user_login(test_email, test_password);
      const last_time_shipped_header = page.waitForSelector(
        '#last-time-shipped-header',
        { visible: true },
      );

      expect(last_time_shipped_header).to.exist;
    });

    beforeEach(async () => {
      await page.goto(H.absoluteUrl());
    });

    it('redirect missing Lane names to the Lanes Page', async () => {
      const missing_lane_name_path = 'lanes//ship';
      const lanes_url = `${H.absoluteUrl()}lanes`;

      await page.goto(`${H.absoluteUrl()}${missing_lane_name_path}`);
      expect(page.url()).to.eq(lanes_url);
    });

    it('allow viewing the Users Page showing all users', async () => {
      await page.goto(users_url);
      const users_page = page.waitForSelector('#users-page', { visible: true });
      const users_list = page.waitForSelector('.users-table tbody tr', {
        visible: true,
      });
      expect(users_page).to.exist;
      expect(users_list).to.exist;
      expect(users_list.length);
    });

    it('allow inviting a new User', async () => {
      await page.goto(users_url);
      await page.click('.invite-user');
      const new_user = faker.internet.email();

      const add_user_page = page.waitForSelector('#add-user-page', {
        visible: true,
      });
      expect(page.url()).to.eq(`${users_url}/add-user`);
      expect(add_user_page).to.exist;

      await page.type('.email-user-invite', new_user);
      await page.click('.send-invitation');

      const users_page = page.waitForSelector('#users-page', { visible: true });
      expect(users_page).to.exist;

      expect(page.url()).to.eq(users_url);
    });

    it('allow viewing a User Profile', async () => {
      await page.goto(users_url);
      await page.click('.users-table tbody tr:first-child .profile');
      const profile_page = await page.waitForSelector('#profile-page', {
        visible: true,
      });

      expect(profile_page).to.exist;
    });
  });
});


