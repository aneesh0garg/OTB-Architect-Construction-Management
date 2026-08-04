import { expect, test } from '@playwright/test';

test('retains PKCE sign-in when a mobile browser has no crypto.subtle on a LAN HTTP origin', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window.crypto, 'subtle', { configurable: true, value: undefined });
  });
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));
  await page.goto('/');

  const authorizationRequest = page.waitForRequest((request) =>
    request.url().includes('/protocol/openid-connect/auth?'),
  );
  await page.getByRole('button', { name: 'Sign in' }).click();
  const request = await authorizationRequest;
  const query = new URL(request.url()).searchParams;

  expect(query.get('code_challenge_method')).toBe('S256');
  expect(query.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(pageErrors).toEqual([]);
});

test('keeps the Staffing and capacity dialog vertically scrollable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Team/ }).click();
  await page.getByRole('button', { name: 'Manage project team' }).click();
  const dialog = page.getByRole('dialog', { name: 'Staffing and capacity' });
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS('overflow-y', 'auto');
  const canScroll = await dialog.evaluate((element) => {
    const filler = document.createElement('div');
    filler.style.height = '180vh';
    element.append(filler);
    element.scrollTop = 300;
    const result = element.scrollTop > 0;
    filler.remove();
    return result;
  });
  expect(canScroll).toBe(true);
});

test('uses an email-based invitation form for organization members', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('orbita.access-token', 'test-access-token'));
  await page.route('**/v1/me', (route) => route.fulfill({ json: { userId: 'admin-1', organizationId: 'northline-studio', roles: ['organization_admin'] } }));
  await page.route('**/v1/workspace', (route) => route.fulfill({ json: { organizationId: 'northline-studio', projects: [], teams: [] } }));
  await page.route('**/v1/notifications/preferences', (route) => route.fulfill({ json: [] }));
  await page.route('**/v1/resources/people', (route) => route.fulfill({ json: [] }));
  await page.route('**/v1/resources/people/invitations', (route) => route.fulfill({ status: 201, json: { user_id: 'new-member', display_name: 'New Member', active: true, organization_role: 'project_member', email: 'new.member@local.orbita', invitation_status: 'pending' } }));
  await page.route('**/v1/resources/teams', (route) => route.fulfill({ json: [] }));
  await page.route('**/v1/resources/capacity**', (route) => route.fulfill({ json: { from: '2026-01-01', to: '2026-01-28', people: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: /Team/ }).click();
  await page.getByRole('button', { name: 'Manage project team' }).click();
  const dialog = page.getByRole('dialog', { name: 'Staffing and capacity' });
  await expect(dialog.getByLabel('Work email')).toHaveAttribute('type', 'email');
  await expect(dialog.getByRole('button', { name: 'Send invitation' })).toBeVisible();
  await expect(dialog.getByText(/Keycloak sends a secure activation link/)).toBeVisible();
  await dialog.getByLabel('Work email').fill('new.member@local.orbita');
  await dialog.getByLabel('Name').fill('New Member');
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(dialog.getByText('Invitation sent to new.member@local.orbita. Check Mailpit to complete activation.')).toBeVisible();
});

test('shows the controlled profile-photo upload for the signed-in member', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('orbita.access-token', 'test-access-token'));
  await page.route('**/v1/me', (route) => route.fulfill({ json: { userId: 'admin-1', organizationId: 'northline-studio', roles: ['organization_admin'] } }));
  await page.route('**/v1/resources/people/admin-1/profile-photo', (route) => route.fulfill({ json: { profilePhotoUrl: null } }));
  await page.route('**/v1/resources/people/admin-1', (route) => route.fulfill({ json: { user_id: 'admin-1', display_name: 'Admin One', title: 'Director', weekly_capacity_hours: 40, active: true, organization_role: 'organization_admin', projects: [] } }));
  await page.goto('/organization/members/admin-1');
  await expect(page.getByText('Profile photo', { exact: true })).toBeVisible();
  await expect(page.getByText('Upload profile photo', { exact: true })).toBeVisible();
  await expect(page.locator('input[type="file"]')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
});

test('exchanges a task deep-link Keycloak callback only once during React development rendering', async ({ page }) => {
  let tokenRequests = 0;
  await page.addInitScript(() => sessionStorage.setItem('orbita.pkce-verifier', 'test-verifier'));
  await page.route('**/protocol/openid-connect/token', async (route) => {
    tokenRequests += 1;
    await route.fulfill({ json: { access_token: 'test-access-token' } });
  });
  await page.route('**/v1/me', async (route) => {
    await route.fulfill({ json: { userId: 'pilot-admin', organizationId: 'northline-studio', roles: ['organization_admin'] } });
  });
  await page.route('**/v1/workspace/projects/project-1/record', async (route) => {
    await route.fulfill({ json: { project: { id: 'project-1', code: 'TEST', name: 'Callback test', status: 'active', location: null, stage: 'construction' }, tasks: [{ id: 'task-1', title: 'Callback task', status: 'open', priority: 'normal', due_date: null, assignee_id: null, source_record_type: null, source_record_id: null }], documents: [], communications: [], members: [], transmittals: [] } });
  });
  await page.route('**/v1/workspace/projects/project-1/tasks/task-1/comments', async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.goto('/projects/project-1/tasks/task-1?code=deep-link-code&session_state=deep-link-session');
  await expect(page.getByRole('heading', { name: 'Callback task' })).toBeVisible();
  await expect.poll(() => tokenRequests).toBe(1);
  await page.waitForTimeout(150);
  expect(tokenRequests).toBe(1);
});

test('shows the signed-in workspace header after a successful Keycloak callback', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('orbita.pkce-verifier', 'test-verifier'));
  await page.route('**/protocol/openid-connect/token', (route) => route.fulfill({ json: { access_token: 'test-access-token' } }));
  await page.route('**/v1/me', (route) => route.fulfill({ json: { userId: 'pilot-admin', organizationId: 'northline-studio', roles: ['organization_admin'] } }));
  await page.route('**/v1/workspace', (route) => route.fulfill({ json: { organizationId: 'northline-studio', projects: [], teams: [] } }));
  await page.route('**/v1/workspace/notification-preferences', (route) => route.fulfill({ json: [] }));
  await page.goto('/?code=successful-callback&session_state=test-session');
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
  await expect(page.getByText('Authenticated as northline-studio')).toBeVisible();
});

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

  test('keeps project record modules reachable on a phone viewport', async ({ page }) => {
    const documents = page.getByTestId('project-tab-documents');
    const tasks = page.getByTestId('project-tab-tasks');
    const communications = page.getByTestId('project-tab-communications');
    const costAndContracts = page.getByTestId('project-tab-cost-&-contracts');

    await documents.click();
    await expect(page.getByTestId('project-view-documents')).toBeVisible();
    await tasks.click();
    await expect(page.getByTestId('project-view-tasks')).toBeVisible();
    await communications.click();
    await expect(page.getByTestId('project-view-communications')).toBeVisible();
    await costAndContracts.click();
    await expect(page.getByTestId('project-view-cost')).toBeVisible();
  });

  test('keeps document register filters and sorting reachable on a phone viewport', async ({
    page,
  }) => {
    await page.getByTestId('project-tab-documents').click();
    await expect(page.getByLabel('Search documents')).toBeVisible();
    await expect(page.getByLabel('Filter document status')).toBeVisible();
    await expect(page.getByLabel('Filter document type')).toBeVisible();
    await expect(page.getByLabel('Sort documents')).toBeVisible();
  });

  test('opens Documents when randomUUID is unavailable in a mobile browser', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.crypto, 'randomUUID', { configurable: true, value: undefined });
    });
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));
    await page.goto('/');
    await page.getByTestId('project-tab-documents').click();
    await expect(page.getByTestId('project-view-documents')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('keeps project creation reachable on a phone viewport', async ({ page }) => {
    await page.getByRole('button', { name: '+ New project' }).click();
    await expect(page.getByRole('dialog', { name: 'Create project' })).toContainText(
      'Sign in to create a project and its delivery team',
    );
    await page.getByRole('button', { name: 'Close create project' }).click();
  });

  test('keeps the single project team visible in mobile workspace navigation', async ({ page }) => {
    const projects = page.getByRole('button', { name: '◫ Projects' });
    await expect(projects).toBeVisible();
    await projects.click();
    await expect(page.getByRole('dialog', { name: 'Projects' })).toBeVisible();
    await page.getByRole('button', { name: 'Close projects' }).click();

    const teams = page.getByRole('button', { name: '◉ Team' });
    await expect(teams).toBeVisible();
    await teams.click();
    await expect(page.getByRole('dialog', { name: 'Project team' })).toBeVisible();
  });

  test('keeps named project people and roles reachable on a phone viewport', async ({ page }) => {
    await page.getByRole('button', { name: 'Manage project people and roles' }).click();
    await expect(page.getByRole('dialog', { name: 'Project people and roles' })).toContainText(
      'Sign in and select a connected project',
    );
    await page.getByRole('button', { name: 'Close project people and roles' }).click();
  });

  test('routes drawing upload to the controlled document workflow', async ({ page }) => {
    await page.getByTestId('project-tab-drawings').click();
    await page.getByRole('button', { name: 'Upload drawing' }).click();
    await expect(page.getByTestId('project-view-documents')).toBeVisible();
  });

  test('filters the drawing register on a phone viewport', async ({ page }) => {
    await page.getByTestId('project-tab-drawings').click();
    await page.getByRole('button', { name: 'Current only' }).click();
    await expect(page.getByRole('button', { name: 'Show all' })).toBeVisible();
  });

  test('allows a demo work-queue item to be checked on a phone viewport', async ({ page }) => {
    const checkbox = page.getByRole('checkbox', {
      name: 'Mark Review staircase shop drawing complete',
    });
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('keeps field observation capture reachable on a phone viewport', async ({ page }) => {
    await page.getByTestId('project-tab-field').click();
    await page.getByRole('button', { name: '＋ Capture observation' }).click();
    await expect(page.getByRole('dialog', { name: 'Capture field observation' })).toContainText(
      'Sign in to capture a project observation',
    );
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
