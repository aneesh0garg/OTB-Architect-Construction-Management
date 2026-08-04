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
    await expect(page).toHaveURL(/\/projects\/[^/]+\/tasks\/[^/]+$/);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();

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

  test('opens an invoice accounting record after creating it', async ({ page }) => {
    await page.getByTestId('project-tab-cost-&-contracts').click();
    await page.getByLabel('Client').fill(`UI owner ${Date.now()}`);
    await page.getByLabel('Description').fill('Construction administration monthly fee');
    await page.getByLabel('Amount').fill('12500');
    await page.getByRole('button', { name: 'Create invoice' }).click();

    const openInvoices = page.getByRole('button', { name: 'Open invoice' });
    const count = await openInvoices.count();
    expect(count).toBeGreaterThan(0);
    await openInvoices.nth(count - 1).click();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/invoices\/[^/]+$/);
    await expect(page.getByText('Invoice basis')).toBeVisible();
    await expect(page.getByText('Payments')).toBeVisible();
  });
});
