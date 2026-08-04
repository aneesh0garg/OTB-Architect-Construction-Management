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
    await page.getByLabel('Task due date').fill('2026-12-31');
    const assignee = page.getByLabel('Task assignee');
    const assigneeOptions = await assignee.locator('option').count();
    if (assigneeOptions > 1) await assignee.selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Add task' }).click();
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  });

  test('creates a workspace team and project', async ({ page }) => {
    const suffix = Date.now();
    const teamName = `UI team ${suffix}`;
    await page.getByLabel('Create team').click();
    await page.getByLabel('Team name').fill(teamName);
    await page.getByRole('button', { name: 'Create team' }).click();
    await expect(page.getByText(`# ${teamName}`, { exact: true })).toBeVisible();

    const projectName = `UI project ${suffix}`;
    await page.getByLabel('Create project').click();
    await page.getByLabel('Project name').fill(projectName);
    await page.getByLabel('Project code').fill(`UI${suffix}`.slice(0, 24));
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { name: projectName })).toBeVisible();
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

    const updatedTitle = `${title} updated`;
    await page.getByRole('button', { name: 'Edit task' }).click();
    await page.getByLabel('Title').fill(updatedTitle);
    await page.getByRole('button', { name: 'Save task' }).click();
    await expect(page.getByRole('heading', { name: updatedTitle })).toBeVisible();

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

  test('builds an editable proposal for an opportunity', async ({ page }) => {
    const suffix = Date.now();
    const projectName = `UI proposal project ${suffix}`;
    await page.getByRole('link', { name: '◫ Portfolio' }).click();
    await page.getByLabel('Client').fill(`UI proposal client ${suffix}`);
    await page.getByLabel('Project').fill(projectName);
    await page.getByLabel('Anticipated fee').fill('42000');
    await page.getByRole('button', { name: 'Create opportunity' }).click();

    const opportunity = page.locator('article', { hasText: projectName });
    await opportunity.getByRole('button', { name: 'Build proposal' }).click();
    await opportunity.getByLabel('Scope').fill('Construction-administration services for the proposal project.');
    await opportunity.getByLabel('Assumptions').fill('Weekly site access is available.');
    await opportunity.getByLabel('Exclusions').fill('Statutory fees are excluded.');
    await opportunity.getByLabel('Fee').fill('42000');
    await opportunity.getByLabel('Phase').fill('Construction administration');
    await opportunity.getByLabel('Phase hours').fill('120');
    await opportunity.getByRole('button', { name: 'Create proposal' }).click();
    await expect(opportunity.getByText('Proposal v1')).toBeVisible();
  });
});
