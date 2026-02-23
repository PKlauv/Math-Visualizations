// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Performance & Lazy Loading', () => {
  test('Plotly is NOT loaded on home page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    // Give scripts time to execute
    await page.waitForTimeout(1500);

    const plotlyDefined = await page.evaluate(() => typeof Plotly !== 'undefined');
    expect(plotlyDefined).toBe(false);
  });

  test('Plotly IS loaded after navigating to Lorenz tab', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Navigate to Lorenz (Plotly-dependent)
    await page.click('[data-tab="lorenz"]');
    // Wait for Plotly to load and viz to initialize
    await page.waitForFunction(() => typeof Plotly !== 'undefined', {}, { timeout: 15000 });

    const plotlyDefined = await page.evaluate(() => typeof Plotly !== 'undefined');
    expect(plotlyDefined).toBe(true);
  });

  test('Plotly is NOT loaded on Sierpinski tab (canvas-based)', async ({ page }) => {
    await page.goto('/#sierpinski');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const plotlyDefined = await page.evaluate(() => typeof Plotly !== 'undefined');
    expect(plotlyDefined).toBe(false);
  });

  test('Plotly is NOT loaded on Mandelbrot tab (canvas-based)', async ({ page }) => {
    await page.goto('/#mandelbrot');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);

    const plotlyDefined = await page.evaluate(() => typeof Plotly !== 'undefined');
    expect(plotlyDefined).toBe(false);
  });

  test('Supabase is lazy-loaded (not present on initial load of viz tab)', async ({ page }) => {
    await page.goto('/#lorenz');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1000);

    const supabaseDefined = await page.evaluate(() => typeof supabase !== 'undefined');
    // Should NOT be loaded since we're not viewing the feedback form
    expect(supabaseDefined).toBe(false);
  });

  test('home page loads without Plotly or Supabase script tags in head', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const plotlyScript = await page.evaluate(() => {
      var scripts = document.querySelectorAll('head script[src*="plotly"]');
      return scripts.length;
    });
    expect(plotlyScript).toBe(0);

    const supabaseScript = await page.evaluate(() => {
      var scripts = document.querySelectorAll('head script[src*="supabase"]');
      return scripts.length;
    });
    expect(supabaseScript).toBe(0);
  });
});
