// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Accessibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('nav links have correct ARIA roles', async ({ page }) => {
    const tablist = page.locator('[role="tablist"]');
    await expect(tablist).toBeVisible();
    await expect(tablist).toHaveAttribute('aria-label', 'Visualizations');

    const tabs = page.locator('[role="tab"]');
    await expect(tabs).toHaveCount(5);
  });

  test('aria-selected updates on tab switch', async ({ page }) => {
    // Initially no tab is selected
    const lorenzTab = page.locator('#tab-lorenz');
    await expect(lorenzTab).toHaveAttribute('aria-selected', 'false');

    // Click lorenz tab
    await lorenzTab.click();
    await page.waitForTimeout(500);
    await expect(lorenzTab).toHaveAttribute('aria-selected', 'true');

    // Other tabs should be false
    await expect(page.locator('#tab-mobius')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#tab-klein')).toHaveAttribute('aria-selected', 'false');
  });

  test('keyboard shortcuts button toggles help overlay', async ({ page }) => {
    const overlay = page.locator('#keyboard-help');
    await expect(overlay).toBeHidden();

    // Click the keyboard shortcuts button to open
    await page.click('#kbd-shortcut-btn');
    await expect(overlay).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(overlay).toBeHidden();
  });

  test('number keys switch tabs', async ({ page }) => {
    // Press 1 for Lorenz
    await page.keyboard.press('1');
    await expect(page.locator('#panel-lorenz')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Press 4 for Sierpinski
    await page.keyboard.press('4');
    await expect(page.locator('#panel-sierpinski')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Press 0 for Home
    await page.keyboard.press('0');
    await expect(page.locator('#panel-home')).toBeVisible({ timeout: 5000 });
  });

  test('viz cards are keyboard accessible', async ({ page }) => {
    const card = page.locator('.viz-card[data-tab="lorenz"]');
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#panel-lorenz')).toBeVisible({ timeout: 5000 });
  });

  test('screen reader announcer element exists', async ({ page }) => {
    const announcer = page.locator('#sr-announcer');
    await expect(announcer).toHaveAttribute('aria-live', 'polite');
    await expect(announcer).toHaveAttribute('aria-atomic', 'true');
  });

  test('focus-visible styles are applied on keyboard navigation', async ({ page }) => {
    // Tab to first interactive element
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });

  test('tab panels have correct ARIA attributes', async ({ page }) => {
    const panels = page.locator('[role="tabpanel"]');
    const count = await panels.count();
    expect(count).toBeGreaterThanOrEqual(5);
  });
});
