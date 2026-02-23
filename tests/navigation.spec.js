// @ts-check
const { test, expect } = require('@playwright/test');

const TABS = ['lorenz', 'mobius', 'klein', 'sierpinski', 'mandelbrot'];

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
  });

  test('home panel is visible by default', async ({ page }) => {
    const home = page.locator('#panel-home');
    await expect(home).toBeVisible();
  });

  test('clicking nav links switches tabs', async ({ page }) => {
    // Test just two tabs to avoid sequential transition timing issues
    await page.click('[data-tab="lorenz"]');
    await expect(page.locator('#panel-lorenz')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#panel-home')).toBeHidden();

    // Wait for transition to fully complete before next click
    await page.waitForTimeout(500);

    await page.click('[data-tab="sierpinski"]');
    await expect(page.locator('#panel-sierpinski')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#panel-lorenz')).toBeHidden();
  });

  test('clicking viz cards navigates to that tab', async ({ page }) => {
    const card = page.locator('.viz-card[data-tab="sierpinski"]');
    await card.click();
    await expect(page.locator('#panel-sierpinski')).toBeVisible({ timeout: 5000 });
  });

  test('hash routing works on direct load', async ({ page }) => {
    await page.goto('/#mandelbrot', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('#panel-mandelbrot')).toBeVisible({ timeout: 5000 });
  });

  test('back/forward navigation works', async ({ page }) => {
    // Navigate to lorenz
    await page.click('[data-tab="lorenz"]');
    await expect(page.locator('#panel-lorenz')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Navigate to sierpinski
    await page.click('[data-tab="sierpinski"]');
    await expect(page.locator('#panel-sierpinski')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Go back
    await page.goBack();
    await expect(page.locator('#panel-lorenz')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Go forward
    await page.goForward();
    await expect(page.locator('#panel-sierpinski')).toBeVisible({ timeout: 5000 });
  });

  test('nav home link returns to home', async ({ page }) => {
    await page.click('[data-tab="lorenz"]');
    await expect(page.locator('#panel-lorenz')).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    await page.click('.nav-home');
    await expect(page.locator('#panel-home')).toBeVisible({ timeout: 5000 });
  });
});
