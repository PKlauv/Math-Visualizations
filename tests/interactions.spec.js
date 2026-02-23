// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Interactions', () => {
  test('theme toggle switches between dark and light', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Default should be dark
    const html = page.locator('html');
    const initialTheme = await html.getAttribute('data-theme');

    // Click theme toggle
    await page.click('#theme-toggle');
    const newTheme = await html.getAttribute('data-theme');
    expect(newTheme).not.toBe(initialTheme);

    // Click again to toggle back
    await page.click('#theme-toggle');
    const backTheme = await html.getAttribute('data-theme');
    expect(backTheme).toBe(initialTheme);
  });

  test('Sierpinski depth slider changes visualization', async ({ page }) => {
    await page.goto('/#sierpinski', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const slider = page.locator('#sierpinski-depth-slider');
    const depthVal = page.locator('#sierpinski-depth-val');

    // Change depth to 3
    await slider.fill('3');
    await slider.dispatchEvent('input');
    await expect(depthVal).toHaveText('3');
  });

  test('Sierpinski method select switches mode', async ({ page }) => {
    await page.goto('/#sierpinski', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    const select = page.locator('#sierpinski-method-select');
    await select.selectOption('chaos');

    const hudPhase = page.locator('#sierpinski-hud-phase');
    await expect(hudPhase).toBeVisible();
  });

  test('Mandelbrot canvas responds to click-to-zoom', async ({ page }) => {
    await page.goto('/#mandelbrot', { waitUntil: 'domcontentloaded' });
    // Wait for initial render
    await page.waitForTimeout(2000);

    const canvas = page.locator('#mandelbrot-canvas');
    await expect(canvas).toBeVisible();

    // Click center of canvas to zoom
    await canvas.click();
    await page.waitForTimeout(1000);
    // Verify page didn't crash - canvas still visible
    await expect(canvas).toBeVisible();
  });

  test('keyboard shortcut Space toggles pause on viz tab', async ({ page }) => {
    await page.goto('/#sierpinski', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const hudPhase = page.locator('#sierpinski-hud-phase');

    // Press space to pause
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    const text = await hudPhase.textContent();
    expect(text === 'PAUSED' || text === 'COMPLETE').toBe(true);
  });

  test('keyboard shortcut R resets visualization', async ({ page }) => {
    await page.goto('/#sierpinski', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Press R to reset
    await page.keyboard.press('r');
    await page.waitForTimeout(200);

    const hudPhase = page.locator('#sierpinski-hud-phase');
    const text = await hudPhase.textContent();
    expect(text === 'BUILDING' || text === 'COMPLETE').toBe(true);
  });

  test('Mobius sliders are present and functional', async ({ page }) => {
    await page.goto('/#mobius', { waitUntil: 'domcontentloaded' });
    // Wait for Plotly to lazy-load and init
    await page.waitForFunction(() => typeof Plotly !== 'undefined', {}, { timeout: 15000 });
    await page.waitForTimeout(1000);

    const twistSlider = page.locator('#mobius-twist-slider');
    const twistVal = page.locator('#mobius-twist-val');

    await expect(twistSlider).toBeVisible();
    await expect(twistVal).toHaveText('1');
  });
});
