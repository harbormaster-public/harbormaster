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

describe('Lanes', () => {

  const lanes_route = 'lanes';

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

  it('allow viewing the Lanes Page', async () => {
    await page.click(`.nav-item[href="/${lanes_route}"]`);
    const lanes_url = page.url();
    const lanes_page = page.waitForSelector('#lanes-page', { visible: true });

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
      { visible: true },
    );
    expect(edit_new_lane_page).to.exist;
    expect(page.url()).to.eq(new_lane_url);

    await page.goto(given_lane_url);
    const edit_given_lane_page = await page.waitForSelector(
      '#edit-lane-page',
      { visible: true },
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
      { visible: true },
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
      { visible: true },
    );
    expect(ship_lane_page).to.exist;
  });

});
