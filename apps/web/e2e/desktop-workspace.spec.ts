import { expect, test } from '@playwright/test';

test.describe('desktop workspace controls', () => {
  test('opens project creation from the workspace sidebar', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Create project' }).click();
    const projectDialog = page.getByRole('dialog', { name: 'Create project' });
    await expect(projectDialog).toContainText('Sign in to create a project and its delivery team');
    await page.getByRole('button', { name: 'Close create project' }).click();
  });

  test('opens Pipeline, Staffing, and AI workspace controls', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: '◫ Portfolio' }).click();
    await expect(page.getByRole('dialog', { name: 'Pipeline and proposals' })).toContainText(
      'Sign in to manage opportunities and proposals',
    );
    await page.getByRole('button', { name: 'Close pipeline and proposals' }).click();

    await page.getByRole('link', { name: '◉ Resource capacity' }).click();
    await expect(page.getByRole('dialog', { name: 'Staffing and capacity' })).toContainText(
      'Sign in to manage people, capacity groups, and staffing',
    );
    await page.getByRole('button', { name: 'Close staffing and capacity' }).click();

    await page.getByRole('button', { name: 'AI workspace' }).click();
    await expect(page.getByRole('dialog', { name: 'Evidence before answers' })).toBeVisible();
  });
});
