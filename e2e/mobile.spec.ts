import { expect, test } from '@playwright/test';

test('main flow works at mobile width and exports only verified events', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '受験日程を、 ひとつのカレンダーに。' })).toBeVisible();
  await expect(page.locator('.school-choice')).toHaveCount(7);
  await expect(page.locator('.event')).toHaveCount(6);
  await expect(page.locator('body')).not.toContainText('監査待ち');

  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'カレンダーに追加' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('juken-calendar.ics');
});
