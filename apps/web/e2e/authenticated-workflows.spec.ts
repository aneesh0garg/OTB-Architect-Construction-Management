import { expect, test } from '@playwright/test';

const accessToken = process.env.ORBITA_E2E_ACCESS_TOKEN;

test.describe('authenticated workspace workflows', () => {
  test.skip(!accessToken, 'Set ORBITA_E2E_ACCESS_TOKEN to run governed local workflow checks.');

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      (token) => sessionStorage.setItem('orbita.access-token', token),
      accessToken,
    );
    await page.goto('/');
    await expect(page.getByText('Connected to local workspace')).toBeVisible();
  });

  test('creates a task from the project work queue', async ({ page }) => {
    await page.getByTestId('project-tab-tasks').click();
    const title = `UI task ${Date.now()}`;
    await page.getByLabel('New task').fill(title);
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  });

  test('opens a task detail workspace and persists its discussion', async ({ page }) => {
    await page.getByTestId('project-tab-tasks').click();
    const title = `UI task discussion ${Date.now()}`;
    await page.getByLabel('New task').fill(title);
    await page.getByRole('button', { name: 'Add task' }).click();

    const task = page.locator('article', { hasText: title });
    await task.getByRole('button', { name: 'View details' }).click();
    await expect(page.getByLabel(`Task details for ${title}`)).toBeVisible();

    const comment = 'Coordinate the decision with the site team.';
    await page.getByLabel('Add a comment').fill(comment);
    await page.getByRole('button', { name: 'Post comment' }).click();
    await expect(page.getByText(comment, { exact: true })).toBeVisible();
  });

  test('exposes controlled document and commercial write workflows', async ({ page }) => {
    await page.getByTestId('project-tab-documents').click();
    await expect(page.getByRole('button', { name: 'Upload revision' })).toBeVisible();

    await page.getByTestId('project-tab-cost-&-contracts').click();
    await expect(page.getByRole('button', { name: 'Add budget' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create invoice' })).toBeVisible();
  });
});
