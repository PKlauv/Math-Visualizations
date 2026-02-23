// @ts-check
const { test, expect } = require('@playwright/test');

const PANELS = ['home', 'lorenz', 'mobius', 'klein', 'sierpinski', 'mandelbrot'];

test.describe('Visual regression screenshots', () => {
  for (const panel of PANELS) {
    test(`screenshot: ${panel}`, async ({ page }, testInfo) => {
      const route = panel === 'home' ? '/' : `/#${panel}`;
      await page.goto(route);
      await page.waitForLoadState('domcontentloaded');

      // Wait for initial render / transitions
      await page.waitForTimeout(panel === 'home' ? 1500 : 3000);

      await expect(page).toHaveScreenshot(`${panel}-${testInfo.project.name}.png`, {
        maxDiffPixelRatio: 0.05,
        timeout: 10000,
      });
    });
  }
});
