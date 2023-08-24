import {
  describe,
  it,
  expect,
  page,
  H,
} from '../../helpers';

describe('Harbors', () => {
  it('allow viewing a Harbor', async () => {
    const harbors_page_url = `${H.absoluteUrl()}harbors`;

    await page.goto(harbors_page_url);
    const harbors_page = await page.waitForSelector(
      '#harbors-page',
      { visible: true },
    );
    expect(harbors_page).to.exist;
  });

});

