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

  test('opens Pipeline, Staffing, and AI workspace controls', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: '◫ Portfolio' }).click();
    await expect(page.getByRole('dialog', { name: 'Pipeline and proposals' })).toContainText(
      'Sign in to manage opportunities and proposals',
    );
    await page.getByRole('button', { name: 'Close pipeline and proposals' }).click();

    await page.getByRole('link', { name: '◉ My teams' }).click();
    await expect(page.getByRole('dialog', { name: 'Staffing and capacity' })).toContainText(
      'Sign in to manage people, teams, and capacity',
    );
    await page.getByRole('button', { name: 'Close staffing and capacity' }).click();

    await page.getByRole('button', { name: 'AI workspace' }).click();
    await expect(page.getByRole('dialog', { name: 'Evidence before answers' })).toBeVisible();
  });
});
