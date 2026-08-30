import { expect, test } from '@playwright/test';

test('school and mock-exam selection works at mobile width with add and remove exports', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '受験日程を、 ひとつのカレンダーに。' })).toBeVisible();
  await expect(page.locator('.source-choice')).toHaveCount(35);
  await expect(page.locator('.event')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('監査待ち');

  await page.getByLabel('学校名を検索').fill('浦和明の星');
  await page.getByLabel('都県').selectOption('埼玉県');
  await page.getByLabel('男女区分').selectOption('女子');
  await page.getByLabel('日程').selectOption('has-events');
  const schoolGroup = page.locator('.source-group').filter({ has: page.getByRole('heading', { name: '学校' }) });
  await expect(schoolGroup.locator('.source-choice')).toHaveCount(1);
  await schoolGroup.getByText('浦和明の星女子中学校', { exact: true }).click();
  await expect(page.locator('.selected-school-list')).toContainText('浦和明の星女子中学校');
  await expect(page.locator('.event').first()).toBeVisible();

  await page.reload();
  await expect(page.locator('.selected-school-list')).toContainText('浦和明の星女子中学校');
  await page.locator('.selected-school-list button').click();
  await expect(page.locator('.selected-school-list')).toContainText('まだ学校を選択していません');

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
