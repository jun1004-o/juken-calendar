import { expect, test } from '@playwright/test';

test('school and mock-exam selection works at mobile width with add and remove exports', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '受験日程を、 ひとつのカレンダーに。' })).toBeVisible();
  await expect(page.locator('.source-choice')).toHaveCount(11);
  await expect(page.locator('.event')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('監査待ち');

  const mockGroup = page.locator('.source-group').filter({ has: page.getByRole('heading', { name: '模試' }) });
  await mockGroup.getByRole('button', { name: 'すべて選択' }).click();
  await expect(page.locator('.event')).toHaveCount(28);
  await expect(page.getByText('28件をカレンダー操作')).toBeVisible();

  const width = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(width.scroll).toBeLessThanOrEqual(width.client);

  const addDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Googleカレンダーへ追加' }).click();
  expect((await addDownload).suggestedFilename()).toBe('juken-calendar-add.ics');

  const removeDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Googleカレンダーから削除' }).click();
  expect((await removeDownload).suggestedFilename()).toBe('juken-calendar-remove.ics');
});
