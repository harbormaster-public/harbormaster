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

describe('Profiles', () => {

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

  it('allow viewing a User Profile', async () => {
    await page.goto(users_url);
    await page.click('.users-table tbody tr:first-child .profile');
    const profile_page = await page.waitForSelector('#profile-page', {
      visible: true,
    });

    expect(profile_page).to.exist;
  });
});
