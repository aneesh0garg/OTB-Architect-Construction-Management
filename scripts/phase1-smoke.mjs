import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const apiUrl = (process.env.ORBITA_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const issuer = (
  process.env.ORBITA_KEYCLOAK_ISSUER ?? 'http://localhost:8180/realms/orbita'
).replace(/\/$/, '');
const username = process.env.ORBITA_SMOKE_USERNAME ?? 'pilot-admin';
const password = process.env.ORBITA_SMOKE_PASSWORD ?? 'pilot_local';
const runId = randomUUID().slice(0, 8);

const tokenResponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: 'orbita-mobile',
    username,
    password,
  }),
});
const tokenPayload = await tokenResponse.json();
assert.equal(
  tokenResponse.ok,
  true,
  `Keycloak token request failed: ${JSON.stringify(tokenPayload)}`,
);
assert.ok(tokenPayload.access_token, 'Keycloak did not return an access token.');

async function api(method, path, body) {
  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${tokenPayload.access_token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => undefined);
  assert.equal(response.ok, true, `${method} ${path} failed: ${JSON.stringify(payload)}`);
  return payload;
}

async function apiText(path) {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { authorization: `Bearer ${tokenPayload.access_token}` },
  });
  const content = await response.text();
  assert.equal(response.ok, true, `GET ${path} failed: ${content}`);
  return content;
}

await api('GET', '/health');
const identity = await api('GET', '/v1/me');
assert.equal(identity.displayName, 'Pilot Administrator', 'Signed-in profile was not mapped.');
await api('POST', '/v1/workspace/organization', { name: 'Orbita Phase 1 Smoke' });
const zohoConnections = await api('GET', '/v1/integrations/zoho-books');
assert.equal(Array.isArray(zohoConnections), true, 'Zoho connection list is unavailable.');
const unconfiguredZoho = await fetch(`${apiUrl}/v1/integrations/zoho-books/connect`, {
  method: 'POST',
  headers: { authorization: `Bearer ${tokenPayload.access_token}` },
});
assert.equal(unconfiguredZoho.status, 400, 'Unconfigured Zoho connection was not safely blocked.');
const person = await api('POST', '/v1/resources/people', {
  userId: `smoke-person-${runId}`,
  displayName: `Smoke resource ${runId}`,
  title: 'Project director',
  weeklyCapacityHours: 40,
});
const project = await api('POST', '/v1/workspace/projects', {
  code: `SMK-${runId}`,
  name: `Phase 1 smoke ${runId}`,
  location: 'Dehradun',
  stage: 'construction_administration',
});
assert.ok(project.id, 'Project creation did not return an ID.');
const projectPath = `/v1/workspace/projects/${project.id}`;
const contractorTokenResponse = await fetch(`${issuer}/protocol/openid-connect/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'password',
    client_id: 'orbita-mobile',
    username: 'pilot-contractor',
    password: 'pilot_contractor',
  }),
});
const contractorToken = await contractorTokenResponse.json();
assert.equal(
  contractorTokenResponse.ok,
  true,
  `Contractor token request failed: ${JSON.stringify(contractorToken)}`,
);
const contractorId = JSON.parse(
  Buffer.from(contractorToken.access_token.split('.')[1], 'base64url').toString('utf8'),
).sub;
const unsharedRecord = await fetch(`${apiUrl}${projectPath}/record`, {
  headers: { authorization: `Bearer ${contractorToken.access_token}` },
});
assert.equal(unsharedRecord.ok, false, 'Unshared contractor could read the project.');
await api('POST', `${projectPath}/collaborators`, { userId: contractorId, role: 'contractor' });
const sharedRecord = await fetch(`${apiUrl}${projectPath}/record`, {
  headers: { authorization: `Bearer ${contractorToken.access_token}` },
});
assert.equal(sharedRecord.ok, true, 'Shared contractor could not read the project.');
const activeProject = await api('POST', `${projectPath}/status`, { status: 'active' });
assert.equal(activeProject.status, 'active', 'Project did not transition to active.');

const task = await api('POST', `${projectPath}/tasks`, {
  title: `Verify facade coordination ${runId}`,
  priority: 'high',
  assigneeId: 'pilot-admin',
});
assert.equal(task.title, `Verify facade coordination ${runId}`);
await api('POST', `${projectPath}/documents`, {
  documentNumber: `A-${runId}`,
  documentType: 'drawing',
  title: `Smoke facade drawing ${runId}`,
  revision: 'A',
  status: 'issued',
  issueDate: '2026-08-04',
});
await api('POST', `${projectPath}/documents`, {
  documentNumber: `A-${runId}`,
  documentType: 'drawing',
  title: `Smoke facade drawing ${runId}`,
  revision: 'B',
  status: 'issued',
  issueDate: '2026-08-05',
});
const communication = await api('POST', `${projectPath}/communications`, {
  channel: 'email',
  direction: 'inbound',
  subject: `Facade coordination ${runId}`,
  body: 'Please confirm the facade cavity depth before the next site instruction.',
  sender: 'contractor@example.test',
  recipients: ['pilot-admin@local.orbita'],
  sourceMessageId: `smoke-message-${runId}`,
});
const repeatedCommunication = await api('POST', `${projectPath}/communications`, {
  channel: 'email',
  direction: 'inbound',
  subject: `Facade coordination ${runId}`,
  body: 'Please confirm the facade cavity depth before the next site instruction.',
  sender: 'contractor@example.test',
  recipients: ['pilot-admin@local.orbita'],
  sourceMessageId: `smoke-message-${runId}`,
});
assert.equal(repeatedCommunication.id, communication.id, 'Email filing was not idempotent.');

const captureId = `smoke-capture-${runId}`;
const observation = await api('POST', `/v1/projects/${project.id}/observations`, {
  clientCaptureId: captureId,
  title: `Facade observation ${runId}`,
  description: 'Captured by the Phase 1 smoke workflow.',
  location: 'Level 2',
  priority: 'high',
  syncState: 'synced',
});
const repeatedObservation = await api('POST', `/v1/projects/${project.id}/observations`, {
  clientCaptureId: captureId,
  title: `Facade observation ${runId}`,
  description: 'Captured by the Phase 1 smoke workflow.',
  location: 'Level 2',
  priority: 'high',
  syncState: 'synced',
});
assert.equal(repeatedObservation.id, observation.id, 'Mobile capture retry was not idempotent.');
const rfi = await api('POST', `/v1/projects/${project.id}/workflows`, {
  recordType: 'rfi',
  title: `Facade cavity RFI ${runId}`,
  data: { question: 'Confirm facade cavity depth.' },
});
const issuedRfi = await api('POST', `/v1/projects/${project.id}/workflows/${rfi.id}/transitions`, {
  status: 'issued',
  note: 'Issued by smoke workflow.',
});
assert.equal(issuedRfi.status, 'issued');
const search = await api(
  'GET',
  `/v1/projects/${project.id}/search?q=${encodeURIComponent(`facade ${runId}`)}`,
);
assert.ok(search.results.length > 0, 'Project search did not return matching evidence.');

const phase = await api('POST', `/v1/projects/${project.id}/finance/phases`, {
  name: 'Construction administration',
  plannedFee: 250000,
  targetHours: 120,
});
await api('POST', `/v1/projects/${project.id}/finance/allocations`, {
  phaseId: phase.id,
  staffId: person.user_id,
  startsOn: '2026-08-04',
  endsOn: '2026-08-10',
  plannedHours: 28,
});
const capacity = await api('GET', '/v1/resources/capacity?from=2026-08-04&to=2026-08-10');
assert.equal(capacity.people.find((item) => item.user_id === person.user_id)?.allocatedHours, 28);
await api('POST', `/v1/projects/${project.id}/finance/budgets`, {
  costCode: 'CIV-100',
  name: 'Civil works baseline',
  amount: 250000,
});
await api('POST', `/v1/projects/${project.id}/finance/commitments`, {
  vendorName: 'Smoke Civil Contractor',
  description: 'Civil works commitment',
  originalAmount: 175000,
  approvedAmount: 175000,
  status: 'approved',
});
const changeEvent = await api('POST', `/v1/projects/${project.id}/finance/change-events`, {
  code: `CE-${runId}`,
  description: 'Facade coordination change',
  amount: 25000,
});
await api('POST', `/v1/projects/${project.id}/finance/change-events/${changeEvent.id}/status`, {
  status: 'approved',
});
const cost = await api('GET', `/v1/projects/${project.id}/finance/cost`);
assert.equal(cost.health.forecastAtCompletion, 200000, 'Cost forecast is not reconciled.');
const time = await api('POST', `/v1/projects/${project.id}/finance/time`, {
  phaseId: phase.id,
  entryDate: '2026-08-04',
  hours: 4,
  note: 'Smoke site coordination.',
});
await api('POST', `/v1/projects/${project.id}/finance/time/${time.id}/status`, {
  status: 'submitted',
});
const invoice = await api('POST', `/v1/projects/${project.id}/finance/invoices`, {
  clientName: 'Smoke Owner',
  issueDate: '2026-08-04',
  dueDate: '2026-08-18',
  gstRate: 18,
  lines: [
    {
      sourceType: 'fixed_fee_milestone',
      sourceId: phase.id,
      description: 'Construction administration milestone',
      quantity: 1,
      unitAmount: 50000,
    },
  ],
});
await api('POST', `/v1/projects/${project.id}/finance/invoices/${invoice.id}/status`, {
  status: 'internal_review',
});
const issuedInvoice = await api(
  'POST',
  `/v1/projects/${project.id}/finance/invoices/${invoice.id}/status`,
  {
    status: 'issued',
  },
);
await api('POST', `/v1/projects/${project.id}/finance/invoices/${invoice.id}/payments`, {
  amount: Number(issuedInvoice.total),
  paidDate: '2026-08-05',
  reference: `SMOKE-${runId}`,
});
const notifications = await api('GET', '/v1/workspace/notifications');
for (const eventType of ['workflow.issued', 'invoice.issued', 'payment.recorded']) {
  assert.equal(
    notifications.some((notification) => notification.event_type === eventType),
    true,
    `Notification ${eventType} was not created.`,
  );
}
const finance = await api('GET', `/v1/projects/${project.id}/finance`);
assert.equal(
  finance.health.paid,
  Number(issuedInvoice.total),
  'Payment was not reflected in finance health.',
);

await api('POST', '/v1/ai/settings', { enabled: true });
const retrieval = await api(
  'GET',
  `/v1/projects/${project.id}/brain/search?q=${encodeURIComponent(`facade ${runId}`)}`,
);
assert.ok(retrieval.citations.length > 0, 'Project Brain did not return a source citation.');
const draft = await api('POST', `/v1/projects/${project.id}/brain/drafts`, {
  intent: 'rfi_draft',
  prompt: `Draft a facade response for smoke ${runId}`,
});
const approvedDraft = await api(
  'POST',
  `/v1/projects/${project.id}/brain/drafts/${draft.id}/approve`,
);
assert.equal(approvedDraft.status, 'approved');

const projectRecord = await api('GET', `${projectPath}/record`);
assert.equal(
  projectRecord.documents.find((item) => item.revision === 'A')?.status,
  'superseded',
  'Issued document revision was not superseded.',
);
const projectExport = await apiText(`/v1/projects/${project.id}/exports/project.csv`);
assert.match(projectExport, /Facade observation/);
const commercialExport = await apiText(`/v1/projects/${project.id}/exports/commercial.csv`);
assert.match(commercialExport, /Amount \(INR\)/);
const auditEvents = await api('GET', `/v1/workspace/audit?projectId=${project.id}`);
for (const action of [
  'observation.captured',
  'workflow.transitioned',
  'finance.invoice_status_changed',
  'finance.payment_recorded',
  'cost.change_status_changed',
  'project.status_changed',
  'project.search_performed',
  'export.project_csv_created',
  'export.commercial_csv_created',
]) {
  assert.equal(
    auditEvents.some((event) => event.action === action),
    true,
    `Audit event ${action} was not recorded.`,
  );
}
const organizationAudit = await api('GET', '/v1/workspace/audit');
assert.equal(
  organizationAudit.some((event) => event.action === 'resource.person_saved'),
  true,
  'People directory change was not recorded in organization audit.',
);
const closedProject = await api('POST', `${projectPath}/status`, { status: 'closed' });
assert.equal(closedProject.status, 'closed', 'Project did not transition to closed.');
assert.ok(closedProject.retention_until, 'Closing a project did not set the retention date.');
console.log(`Phase 1 smoke passed for ${project.code} (${project.id}).`);
