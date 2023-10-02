import faker from 'faker';
import {
  describe,
  it,
  expect,
  page,
  H,
} from '../../helpers';

describe('Charters', () => {
  it('allow viewing a Charter', async () => {
    const charter_page_url = `${H.absoluteUrl()}lanes/${
      faker.lorem.word()
    }/charter`;

    await page.goto(charter_page_url);
    const charter_page = await page.waitForSelector(
      '#charter-page',
      { visible: true },
    );
    expect(charter_page).to.exist;
  });

});
