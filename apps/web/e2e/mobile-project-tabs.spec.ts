import { expect, test } from '@playwright/test';

test.describe('mobile project navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('keeps the supported project tabs reachable and switches their views', async ({ page }) => {
    const navigation = page.getByRole('navigation', { name: 'Project sections' });

    await expect(navigation).toBeVisible();
    await expect(page.getByTestId('project-view-overview')).toBeVisible();

    await page.getByTestId('project-tab-drawings').click();
    await expect(page.getByTestId('project-view-drawings')).toBeVisible();
    await expect(page.getByTestId('project-tab-drawings')).toHaveAttribute('aria-current', 'page');

    await page.getByTestId('project-tab-field').click();
    await expect(page.getByTestId('project-view-field')).toBeVisible();
    await expect(page.getByTestId('project-tab-field')).toHaveAttribute('aria-current', 'page');

    await page.getByTestId('project-tab-overview').click();
    await expect(page.getByTestId('project-view-overview')).toBeVisible();
    await expect(page.getByTestId('project-tab-overview')).toHaveAttribute('aria-current', 'page');
  });

  test('makes unavailable modules explicit rather than treating them as mobile navigation', async ({
    page,
  }) => {
    const documents = page.getByTestId('project-tab-documents');
    const tasks = page.getByTestId('project-tab-tasks');
    const communications = page.getByTestId('project-tab-communications');
    const costAndContracts = page.getByTestId('project-tab-cost-&-contracts');

    await expect(documents).toBeDisabled();
    await expect(documents).toHaveAttribute('title', 'Documents is planned for a later release');
    await expect(tasks).toBeDisabled();
    await expect(communications).toBeDisabled();
    await expect(costAndContracts).toBeDisabled();
  });

  test('keeps notification preferences accessible on a phone viewport', async ({ page }) => {
    await page.getByTestId('notification-settings-trigger').click();

    const dialog = page.getByRole('dialog', { name: 'Notification settings' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Sign in to set your delivery preferences.');

    await page.getByRole('button', { name: 'Close notification settings' }).click();
    await expect(dialog).toBeHidden();
  });

  test('keeps the governed Project Brain panel reachable on a phone viewport', async ({ page }) => {
    await page.getByRole('button', { name: 'Ask Orbita AI →' }).click();

    const dialog = page.getByRole('dialog', { name: 'Evidence before answers' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Sign in and open a connected project');

    await page.getByRole('button', { name: 'Close Project Brain' }).click();
    await expect(dialog).toBeHidden();
  });

  test('keeps the in-app notification feed reachable on a phone viewport', async ({ page }) => {
    await page.getByRole('button', { name: 'Project activity' }).click();

    const dialog = page.getByRole('dialog', { name: 'Notifications' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Sign in to view your permitted project activity.');

    await page.getByRole('button', { name: 'Close notifications' }).click();
    await expect(dialog).toBeHidden();
  });
});
