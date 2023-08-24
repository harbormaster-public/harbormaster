import faker from 'faker';

const test_email = faker.internet.email();
const test_password = faker.internet.password();

import {
  describe,
  it,
  before,
  beforeEach,
  expect,
  page,
  reset_users,
  create_test_user,
  test_user_login,
  H,
} from '../../helpers';

describe('Users', () => {

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

});
