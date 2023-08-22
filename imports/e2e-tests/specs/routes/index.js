import faker from 'faker';

const test_email = faker.internet.email();
const test_password = faker.internet.password();

import {
  after,
  afterEach,
  describe,
  it,
  before,
  beforeEach,
  browser,
  page,
  reset_users,
  create_test_user,
  test_user_login,
  screenshot,
  H,
  expect,
} from '../../helpers';

describe('Routes', function () {
  before(async () => {
    await reset_users();
  });

  after(async () => {
    await browser.close();
    // Something doesn't seem to be cleaning up properly, and the process
    // seems to hang when the tests complete, pass or fail.  For now,
    // We'll just bail if we wait for longer than 5s after the tests are run.
    setTimeout(() => {
      console.log(`Test run complete, exiting.`);
      process.exit();
    }, 5000);
  });

  afterEach(async () => {
    const { state, title } = this.ctx.currentTest;
    // Ensure to fail the whole run if any of the tests fail.
    if (state == 'failed') {
      const error_date = 'error-' + Date.now();
      await screenshot(error_date, title);
      process.exitCode = 1;
    }
  });

  beforeEach(async function () {
    await page.goto(H.absoluteUrl());
    let header = await page.waitForSelector('h1', {visible: true});
    // let header = await page.waitForSelector('h1');

    // expect(header).to.exist.and.be.visible;
    expect(header).to.exist;
    // expect(header).to.be.visible;
  });

  describe('when there are no users', function () {

    beforeEach(async () => {
      await reset_users();
    });

    it('show the Welcome Page', async function () {
      // const add_user_page = await page.waitForSelector('#add-user-page', {
      //   visible: true,
      // });
      const new_instance_form = await page.waitForSelector('#new-instance', {
        visible: true,
      });

      expect(new_instance_form).to.exist;
      // expect([add_user_page, new_instance_form]).to.exist;
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
    const lanes_route = 'lanes';
    const users_url = `${H.absoluteUrl()}users`;

    before(async () => {
      await reset_users();
      await create_test_user(test_email, test_password);
      await page.goto(H.absoluteUrl());
      await page.reload();
      await test_user_login(test_email, test_password);
      const last_time_shipped_header = page.waitForSelector(
        '#last-time-shipped-header',
        {visible: true},
      );

      expect(last_time_shipped_header).to.exist;
    });

    beforeEach(async () => {
      await page.goto(H.absoluteUrl());
    });

    it('allow viewing the Lanes Page', async () => {
      await page.click(`.nav-item[href="/${lanes_route}"]`);
      const lanes_url = page.url();
      const lanes_page = page.waitForSelector('#lanes-page', {visible: true});

      expect(lanes_url).to.eq(`${H.absoluteUrl()}${lanes_route}`);
      expect(lanes_page).to.exist;

    });

    it('allow creating a new Lane', async () => {
      await page.click(`.nav-item[href="/${lanes_route}"]`);
      await page.click('#new-lane');
      const edit_lane_page = await page.waitForSelector('#edit-lane-page', {
        visible: true,
      });
      const edit_lane_url = `${H.absoluteUrl()}lanes/new/edit`;

      expect(edit_lane_page).to.exist;
      expect(page.url()).to.eq(edit_lane_url);
    });

    it('allow users to edit Lanes using "new" or a given path', async () => {
      const new_lane_url = `${H.absoluteUrl()}lanes/new/edit`;
      const given_lane_url = `${H.absoluteUrl()}lanes/${
        faker.lorem.word()
      }/edit`;

      await page.goto(new_lane_url);
      const edit_new_lane_page = await page.waitForSelector(
        '#edit-lane-page',
        {visible: true},
      );
      expect(edit_new_lane_page).to.exist;
      expect(page.url()).to.eq(new_lane_url);

      await page.goto(given_lane_url);
      const edit_given_lane_page = await page.waitForSelector(
        '#edit-lane-page',
        {visible: true},
      );
      expect(edit_given_lane_page).to.exist;
      expect(page.url()).to.eq(given_lane_url);
    });

    it('allow shipping to a Lane', async () => {
      const ship_lane_page_url = `${H.absoluteUrl()}lanes/${
        faker.lorem.word()
      }/ship`;

      await page.goto(ship_lane_page_url);
      const ship_lane_page = await page.waitForSelector(
        '#ship-lane-page',
        {visible: true},
      );
      expect(ship_lane_page).to.exist;
    });

    it('allow viewing of historical shipments for a Lane', async () => {
      const date = new Date();
      const date_string = `${
        date.getMonth()}-${
        date.getDate()}-${
        date.getHours()}-${
        date.getMinutes()}-${
        date.getSeconds()
      }`;
      const historical_shipped_lane_url = `${H.absoluteUrl()}lanes/${
        faker.lorem.word()
      }/ship/${date_string}`;

      await page.goto(historical_shipped_lane_url);
      const ship_lane_page = await page.waitForSelector(
        '#ship-lane-page',
        {visible: true},
      );
      expect(ship_lane_page).to.exist;
    });

    it('redirect missing Lane names to the Lanes Page', async () => {
      const missing_lane_name_path = 'lanes//ship';
      const lanes_url = `${H.absoluteUrl()}lanes`;

      await page.goto(`${H.absoluteUrl()}${missing_lane_name_path}`);
      expect(page.url()).to.eq(lanes_url);
    });

    it('allow viewing the Users Page showing all users', async () => {
      await page.goto(users_url);
      const users_page = page.waitForSelector('#users-page', {visible: true});
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

      const users_page = page.waitForSelector('#users-page', {visible: true});
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


