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

await api('GET', '/health');
await api('POST', '/v1/workspace/organization', { name: 'Orbita Phase 1 Smoke' });
const project = await api('POST', '/v1/workspace/projects', {
  code: `SMK-${runId}`,
  name: `Phase 1 smoke ${runId}`,
  location: 'Dehradun',
  stage: 'construction_administration',
});
assert.ok(project.id, 'Project creation did not return an ID.');
const projectPath = `/v1/workspace/projects/${project.id}`;

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

const phase = await api('POST', `/v1/projects/${project.id}/finance/phases`, {
  name: 'Construction administration',
  plannedFee: 250000,
  targetHours: 120,
});
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
console.log(`Phase 1 smoke passed for ${project.code} (${project.id}).`);
