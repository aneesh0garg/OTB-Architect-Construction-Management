import { expect, test } from '@playwright/test';

test.describe('desktop workspace controls', () => {
  test('opens project and team creation dialogs from the workspace sidebar', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Create project' }).click();
    const projectDialog = page.getByRole('dialog', { name: 'Create project' });
    await expect(projectDialog).toContainText('Sign in to create projects and teams');
    await page.getByRole('button', { name: 'Close create project' }).click();

    await page.getByRole('button', { name: 'Create team' }).click();
    const teamDialog = page.getByRole('dialog', { name: 'Create team' });
    await expect(teamDialog).toContainText('Sign in to create projects and teams');
  });
});
