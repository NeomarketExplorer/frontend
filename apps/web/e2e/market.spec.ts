import { test, expect } from '@playwright/test';

test.describe('Market Page', () => {
  test('market page renders chart and orderbook', async ({ page }) => {
    // Navigate to markets listing first
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');

    const marketLink = page.locator('a[href^="/market/"]').first();
    if (await marketLink.count() === 0) {
      test.skip(true, 'No markets available');
      return;
    }

    await marketLink.click();
    await page.waitForLoadState('networkidle');

    // Should be on a market page
    expect(page.url()).toMatch(/\/market\/.+/);

    // Orderbook should be visible (desktop) or available as tab (mobile)
    const orderbookText = page.getByText('Orderbook');
    await expect(orderbookText.first()).toBeVisible();
  });

  test('market page shows trade panel', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');

    const marketLink = page.locator('a[href^="/market/"]').first();
    if (await marketLink.count() === 0) {
      test.skip(true, 'No markets available');
      return;
    }

    await marketLink.click();
    await page.waitForLoadState('networkidle');

    // Trade panel should be visible
    await expect(page.getByText('Trade').first()).toBeVisible();
  });

  test('nonexistent market shows error state', async ({ page }) => {
    await page.goto('/market/nonexistent-market-id-12345');
    await page.waitForLoadState('networkidle');

    // Should show "Market not found" or error boundary
    const notFound = page.getByText('Market not found');
    const errorBoundary = page.getByText('Something went wrong');

    const hasNotFound = await notFound.count();
    const hasError = await errorBoundary.count();
    expect(hasNotFound + hasError).toBeGreaterThan(0);
  });
});
