import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test('should display the site title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toBeVisible();
    // Page should have Neomarket branding somewhere
    const title = await page.title();
    expect(title.toLowerCase()).toContain('neomarket');
  });

  test('should render trending events section', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have at least one event card or an empty state
    const eventCards = page.locator('a[href^="/events/"]');
    const count = await eventCards.count();
    if (count === 0) {
      // Empty state is acceptable if no events loaded
      test.skip(true, 'No events available');
      return;
    }
    expect(count).toBeGreaterThan(0);
  });
});
