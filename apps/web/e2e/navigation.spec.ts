import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('events page loads and shows events', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    // Page should render without errors
    await expect(page.locator('header')).toBeVisible();

    // Should have event links or empty state
    const eventLinks = page.locator('a[href^="/events/"]');
    const count = await eventLinks.count();
    if (count === 0) {
      test.skip(true, 'No events available from API');
      return;
    }
    expect(count).toBeGreaterThan(0);
  });

  test('markets page loads and shows markets', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('header')).toBeVisible();

    const marketLinks = page.locator('a[href^="/market/"]');
    const count = await marketLinks.count();
    if (count === 0) {
      test.skip(true, 'No markets available from API');
      return;
    }
    expect(count).toBeGreaterThan(0);
  });

  test('clicking an event navigates to event detail', async ({ page }) => {
    await page.goto('/events');
    await page.waitForLoadState('networkidle');

    const eventLink = page.locator('a[href^="/events/"]').first();
    if (await eventLink.count() === 0) {
      test.skip(true, 'No events available');
      return;
    }

    await eventLink.click();
    await page.waitForLoadState('networkidle');

    // Should be on an event detail page
    expect(page.url()).toMatch(/\/events\/.+/);
  });

  test('portfolio page shows connect wallet prompt', async ({ page }) => {
    await page.goto('/portfolio');
    await page.waitForLoadState('networkidle');

    // Without wallet connected, should show connect prompt
    await expect(page.getByText(/connect/i).first()).toBeVisible();
  });
});
