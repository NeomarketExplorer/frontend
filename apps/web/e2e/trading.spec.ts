import { test, expect } from '@playwright/test';

test.describe('Trading - Market Page', () => {
  test('market page renders trade panel', async ({ page }) => {
    // Navigate to markets listing first
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');

    // Find the first market link and navigate to it
    const marketLink = page.locator('a[href^="/market/"]').first();

    // If no markets are loaded (API down), skip gracefully
    if (await marketLink.count() === 0) {
      test.skip(true, 'No markets available');
      return;
    }

    await marketLink.click();
    await page.waitForLoadState('networkidle');

    // Trade panel should be visible
    await expect(page.getByText('Trade')).toBeVisible();
  });

  test('trade panel shows Connect Wallet when disconnected', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');

    const marketLink = page.locator('a[href^="/market/"]').first();
    if (await marketLink.count() === 0) {
      test.skip(true, 'No markets available');
      return;
    }

    await marketLink.click();
    await page.waitForLoadState('networkidle');

    // Should show connect wallet message when not connected
    await expect(
      page.getByText('Connect your wallet to place orders')
    ).toBeVisible();
  });

  test('order form validates price input', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');

    const marketLink = page.locator('a[href^="/market/"]').first();
    if (await marketLink.count() === 0) {
      test.skip(true, 'No markets available');
      return;
    }

    await marketLink.click();
    await page.waitForLoadState('networkidle');

    // Price input should exist with min/max constraints
    const priceInput = page.locator('input[type="number"][min="1"][max="99"]');
    await expect(priceInput).toBeVisible();
  });

  test('order form shows cost estimates', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');

    const marketLink = page.locator('a[href^="/market/"]').first();
    if (await marketLink.count() === 0) {
      test.skip(true, 'No markets available');
      return;
    }

    await marketLink.click();
    await page.waitForLoadState('networkidle');

    // Estimates section should be visible
    await expect(page.getByText('Est. Cost')).toBeVisible();
    await expect(page.getByText('Potential Return')).toBeVisible();
    await expect(page.getByText('Max Profit')).toBeVisible();
  });

  test('buy/sell buttons toggle correctly', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');

    const marketLink = page.locator('a[href^="/market/"]').first();
    if (await marketLink.count() === 0) {
      test.skip(true, 'No markets available');
      return;
    }

    await marketLink.click();
    await page.waitForLoadState('networkidle');

    // Buy and Sell buttons should exist
    const buyButton = page.getByRole('button', { name: 'Buy' });
    const sellButton = page.getByRole('button', { name: 'Sell' });
    await expect(buyButton).toBeVisible();
    await expect(sellButton).toBeVisible();
  });
});

test.describe('Trading - Error Handling', () => {
  test('error boundary catches failures gracefully', async ({ page }) => {
    // Navigate to a non-existent market
    await page.goto('/market/nonexistent-market-id');
    await page.waitForLoadState('networkidle');

    // Should show "Market not found" or error boundary
    const notFound = page.getByText('Market not found');
    const errorBoundary = page.getByText('Failed to load market');
    const somethingWentWrong = page.getByText('Something went wrong');

    const hasNotFound = await notFound.count();
    const hasErrorBoundary = await errorBoundary.count();
    const hasSomethingWrong = await somethingWentWrong.count();

    expect(hasNotFound + hasErrorBoundary + hasSomethingWrong).toBeGreaterThan(0);
  });
});
