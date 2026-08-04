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
const team = await api('POST', '/v1/workspace/teams', { name: `Smoke team ${runId}` });
await api('POST', '/v1/resources/team-members', {
  teamId: team.id,
  userId: person.user_id,
  role: 'Construction lead',
});
const teams = await api('GET', '/v1/resources/teams');
assert.equal(
  teams.find((item) => item.id === team.id)?.members[0]?.user_id,
  person.user_id,
  'Team roster does not include the assigned person.',
);
const opportunity = await api('POST', '/v1/pipeline/opportunities', {
  clientName: `Smoke client ${runId}`,
  projectName: `Phase 1 smoke ${runId}`,
  projectType: 'Residential',
  stage: 'proposal',
  probability: 75,
  anticipatedFee: 120000,
  targetStartDate: '2026-08-15',
  targetEndDate: '2027-01-15',
  nextAction: 'Approve proposal',
});
const proposal = await api('POST', `/v1/pipeline/opportunities/${opportunity.id}/proposals`, {
  scope: 'Construction-administration scope for smoke verification.',
  assumptions: 'Site access is available weekly.',
  exclusions: 'Statutory fees are excluded.',
  fee: 120000,
  phases: [{ name: 'Proposal administration', plannedFee: 120000, targetHours: 320 }],
  initialStaffing: [
    {
      staffId: person.user_id,
      startsOn: '2026-08-15',
      endsOn: '2027-01-15',
      plannedHours: 80,
      billable: true,
    },
  ],
});
const project = await api('POST', `/v1/pipeline/opportunities/${opportunity.id}/convert`, {
  proposalId: proposal.id,
  projectCode: `SMK-${runId}`,
  location: 'Dehradun',
  stage: 'pursuit',
});
assert.ok(project.id, 'Opportunity conversion did not return a project ID.');
const pipeline = await api('GET', '/v1/pipeline');
const convertedOpportunity = pipeline.opportunities.find((item) => item.id === opportunity.id);
assert.equal(convertedOpportunity.status, 'won', 'Winning opportunity was not closed.');
assert.equal(
  convertedOpportunity.converted_project_id,
  project.id,
  'Converted project link is missing.',
);
const projectPath = `/v1/workspace/projects/${project.id}`;
const contact = await api('POST', '/v1/contacts', {
  displayName: `Smoke consultant ${runId}`,
  companyName: 'Smoke Consultants',
  email: `consultant-${runId}@example.test`,
  discipline: 'Structure',
  role: 'Consultant',
});
await api('POST', `/v1/contacts/${contact.id}/projects`, {
  projectId: project.id,
  relationship: 'Structural consultant',
});
const contacts = await api(
  'GET',
  `/v1/contacts?q=${encodeURIComponent(`Smoke consultant ${runId}`)}`,
);
assert.equal(
  contacts[0]?.projects[0]?.project_id,
  project.id,
  'Contact project relationship is missing.',
);
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
const sharedProjectRecord = await sharedRecord.json();
assert.equal(
  sharedProjectRecord.members.some((member) => member.user_id === contractorId),
  true,
  'Project roster does not include the shared contractor.',
);
const activeProject = await api('POST', `${projectPath}/status`, { status: 'active' });
assert.equal(activeProject.status, 'active', 'Project did not transition to active.');
const stagedProject = await api('POST', `${projectPath}/stage`, {
  stage: 'construction_administration',
});
assert.equal(
  stagedProject.stage,
  'construction_administration',
  'Project stage did not transition to construction administration.',
);

const task = await api('POST', `${projectPath}/tasks`, {
  title: `Verify facade coordination ${runId}`,
  priority: 'high',
  assigneeId: identity.userId,
});
assert.equal(task.title, `Verify facade coordination ${runId}`);
const startedTask = await api('POST', `${projectPath}/tasks/${task.id}/status`, {
  status: 'in_progress',
});
assert.equal(startedTask.status, 'in_progress', 'Task did not transition to in progress.');
const myTasks = await api('GET', '/v1/workspace/my-tasks');
assert.equal(
  myTasks.some((item) => item.id === task.id && item.project_id === project.id),
  true,
  'The assigned task is missing from the personal worklist.',
);
const contractorTaskTransition = await fetch(`${apiUrl}${projectPath}/tasks/${task.id}/status`, {
  method: 'POST',
  headers: {
    authorization: `Bearer ${contractorToken.access_token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({ status: 'blocked' }),
});
assert.equal(
  contractorTaskTransition.status,
  400,
  'Contractor could transition an unrelated task.',
);
await api('DELETE', `${projectPath}/collaborators/${contractorId}`);
const revokedRecord = await fetch(`${apiUrl}${projectPath}/record`, {
  headers: { authorization: `Bearer ${contractorToken.access_token}` },
});
assert.equal(revokedRecord.ok, false, 'Removed contractor retained project access.');
const documentBytes = Buffer.from(`Orbita controlled document ${runId}`, 'utf8');
const preparedUpload = await api('POST', `${projectPath}/documents/uploads`, {
  fileName: `smoke-${runId}.pdf`,
  contentType: 'application/pdf',
  size: documentBytes.length,
});
const preparedBatch = await api('POST', `${projectPath}/documents/uploads/batch`, {
  files: [
    {
      fileName: `smoke-batch-a-${runId}.pdf`,
      contentType: 'application/pdf',
      size: documentBytes.length,
    },
    {
      fileName: `smoke-batch-b-${runId}.pdf`,
      contentType: 'application/pdf',
      size: documentBytes.length,
    },
  ],
});
assert.equal(preparedBatch.uploads.length, 2, 'Bulk upload preparation did not return every file.');
const uploaded = await fetch(preparedUpload.uploadUrl, {
  method: 'PUT',
  headers: { 'content-type': 'application/pdf' },
  body: documentBytes,
});
assert.equal(uploaded.ok, true, 'Signed MinIO upload failed.');
const completedUpload = await api(
  'POST',
  `${projectPath}/documents/uploads/${preparedUpload.uploadId}/complete`,
);
assert.equal(completedUpload.status, 'uploaded', 'Upload was not verified.');
assert.match(completedUpload.checksumSha256, /^[a-f0-9]{64}$/, 'Upload checksum is missing.');
const uploadedDocument = await api('POST', `${projectPath}/documents`, {
  documentNumber: `UP-${runId}`,
  documentType: 'report',
  title: `Uploaded smoke report ${runId}`,
  revision: 'A',
  status: 'draft',
  uploadId: preparedUpload.uploadId,
});
const submittedDocument = await api(
  'POST',
  `${projectPath}/documents/${uploadedDocument.id}/review`,
  { action: 'submit', comment: 'Ready for controlled issue.' },
);
assert.equal(submittedDocument.status, 'internal_review', 'Document was not submitted for review.');
const approvedDocument = await api(
  'POST',
  `${projectPath}/documents/${uploadedDocument.id}/review`,
  { action: 'approve', comment: 'Approved for issue.' },
);
assert.equal(approvedDocument.status, 'approved', 'Document was not approved.');
const issuedDocument = await api('POST', `${projectPath}/documents/${uploadedDocument.id}/issue`);
assert.equal(issuedDocument.status, 'issued', 'Approved document was not issued.');
const download = await api('GET', `${projectPath}/documents/${uploadedDocument.id}/download`);
const downloadedBody = await (await fetch(download.downloadUrl)).text();
assert.equal(
  downloadedBody,
  documentBytes.toString('utf8'),
  'Signed original download did not match.',
);
const uploadFixtures = [
  {
    extension: 'pdf',
    contentType: 'application/pdf',
    bytes: Buffer.from('%PDF-1.4\\n% Orbita smoke PDF\\n'),
  },
  {
    extension: 'jpg',
    contentType: 'image/jpeg',
    bytes: Buffer.from(
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9k=',
      'base64',
    ),
  },
  {
    extension: 'png',
    contentType: 'image/png',
    bytes: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLacQAAAABJRU5ErkJggg==',
      'base64',
    ),
  },
];
const documentTypes = ['drawing', 'specification', 'report', 'contract', 'photo', 'other'];
for (const [index, documentType] of documentTypes.entries()) {
  const fixture = uploadFixtures[index % uploadFixtures.length];
  const documentNumber = `FMT-${runId}-${index}`;
  const uploadRevision = async (revision) => {
    const prepared = await api('POST', `${projectPath}/documents/uploads`, {
      fileName: `${documentNumber}-${revision}.${fixture.extension}`,
      contentType: fixture.contentType,
      size: fixture.bytes.length,
    });
    const stored = await fetch(prepared.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': fixture.contentType },
      body: fixture.bytes,
    });
    assert.equal(stored.ok, true, `${fixture.extension} signed upload failed.`);
    await api('POST', `${projectPath}/documents/uploads/${prepared.uploadId}/complete`);
    const created = await api('POST', `${projectPath}/documents`, {
      documentNumber,
      documentType,
      title: `${documentType} ${revision} ${runId}`,
      revision,
      uploadId: prepared.uploadId,
    });
    const original = await api('GET', `${projectPath}/documents/${created.id}/download`);
    const downloaded = Buffer.from(await (await fetch(original.downloadUrl)).arrayBuffer());
    assert.deepEqual(downloaded, fixture.bytes, `${documentType} original download did not match.`);
    return created;
  };
  const revisionA = await uploadRevision('A');
  await api('POST', `${projectPath}/documents/${revisionA.id}/issue`);
  const revisionB = await uploadRevision('B');
  await api('POST', `${projectPath}/documents/${revisionB.id}/issue`);
  const updatedRecord = await api('GET', `${projectPath}/record`);
  assert.equal(
    updatedRecord.documents.find((item) => item.id === revisionA.id)?.status,
    'superseded',
    `${documentType} revision A was not superseded.`,
  );
  assert.equal(
    updatedRecord.documents.find((item) => item.id === revisionB.id)?.status,
    'issued',
    `${documentType} revision B was not issued.`,
  );
}
await api('POST', `${projectPath}/documents`, {
  documentNumber: `A-${runId}`,
  documentType: 'drawing',
  title: `Smoke facade drawing ${runId}`,
  revision: 'A',
  status: 'issued',
  issueDate: '2026-08-04',
  discipline: 'Architecture',
  building: 'Tower A',
  floor: 'Level 2',
  zone: 'Facade east',
});
const issuedDrawing = await api('POST', `${projectPath}/documents`, {
  documentNumber: `A-${runId}`,
  documentType: 'drawing',
  title: `Smoke facade drawing ${runId}`,
  revision: 'B',
  status: 'issued',
  issueDate: '2026-08-05',
});
const drawingAnnotation = await api(
  'POST',
  `${projectPath}/documents/${issuedDrawing.id}/annotations`,
  { body: `Verify façade bracket spacing ${runId}`, pageNumber: 1, xPercent: 42, yPercent: 58 },
);
const drawingAnnotations = await api(
  'GET',
  `${projectPath}/documents/${issuedDrawing.id}/annotations`,
);
assert.equal(
  drawingAnnotations.some((annotation) => annotation.id === drawingAnnotation.id),
  true,
  'Drawing annotation was not retained.',
);
const transmittal = await api('POST', `${projectPath}/transmittals`, {
  purpose: 'Construction issue',
  issueNote: 'Issued facade drawing for coordination.',
  recipients: ['contractor@example.test'],
  documentIds: [issuedDrawing.id],
});
assert.equal(
  transmittal.document_ids[0],
  issuedDrawing.id,
  'Transmittal did not retain its document.',
);
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
  category: 'Quality',
  trade: 'Waterproofing',
  location: 'Level 2',
  priority: 'high',
  dueDate: '2026-08-12',
  evidence: [
    {
      kind: 'drawing_reference',
      label: `A-502 parapet detail ${runId}`,
      capturedAt: '2026-08-04T09:30:00.000Z',
    },
  ],
  syncState: 'synced',
});
const repeatedObservation = await api('POST', `/v1/projects/${project.id}/observations`, {
  clientCaptureId: captureId,
  title: `Facade observation ${runId}`,
  description: 'Captured by the Phase 1 smoke workflow.',
  category: 'Quality',
  trade: 'Waterproofing',
  location: 'Level 2',
  priority: 'high',
  dueDate: '2026-08-12',
  evidence: [
    {
      kind: 'drawing_reference',
      label: `A-502 parapet detail ${runId}`,
      capturedAt: '2026-08-04T09:30:00.000Z',
    },
  ],
  syncState: 'synced',
});
assert.equal(repeatedObservation.id, observation.id, 'Mobile capture retry was not idempotent.');
const observationComment = await api(
  'POST',
  `/v1/projects/${project.id}/observations/${observation.id}/comments`,
  { body: `Confirm façade waterproofing scope ${runId}`, clientCommentId: `comment-${runId}` },
);
const repeatedObservationComment = await api(
  'POST',
  `/v1/projects/${project.id}/observations/${observation.id}/comments`,
  { body: `Confirm façade waterproofing scope ${runId}`, clientCommentId: `comment-${runId}` },
);
assert.equal(
  repeatedObservationComment.id,
  observationComment.id,
  'Observation comment retry was not idempotent.',
);
const observationComments = await api(
  'GET',
  `/v1/projects/${project.id}/observations/${observation.id}/comments`,
);
assert.equal(
  observationComments.some((comment) => comment.id === observationComment.id),
  true,
  'Observation discussion did not return the saved comment.',
);
const observationRfi = await api('POST', `/v1/projects/${project.id}/workflows`, {
  recordType: 'rfi',
  title: `Observation RFI ${runId}`,
  data: { sourceRecordType: 'observation', sourceObservationId: observation.id },
});
assert.equal(observationRfi.status, 'draft', 'Observation RFI did not remain a draft.');
const observationInstruction = await api('POST', `/v1/projects/${project.id}/workflows`, {
  recordType: 'site_instruction',
  title: `Observation instruction ${runId}`,
  data: { sourceRecordType: 'observation', sourceObservationId: observation.id },
});
assert.equal(
  observationInstruction.status,
  'draft',
  'Observation instruction did not remain a draft.',
);
const fieldVisit = await api('POST', `/v1/projects/${project.id}/field-visits`, {
  clientCaptureId: `smoke-visit-${runId}`,
  visitDate: '2026-08-04',
  location: 'Level 2 facade',
  attendees: ['Pilot administrator'],
  checklist: [{ label: 'Facade reviewed', complete: true }],
  notes: 'Source visit for the smoke report.',
  syncState: 'synced',
});
const report = await api('POST', `/v1/projects/${project.id}/workflows`, {
  recordType: 'site_visit_report',
  title: `Facade site visit report ${runId}`,
  data: { fieldVisitId: fieldVisit.id, observationIds: [observation.id] },
});
assert.equal(report.status, 'draft', 'Site-visit report did not start as a reviewable draft.');
const reviewedReport = await api(
  'POST',
  `/v1/projects/${project.id}/workflows/${report.id}/transitions`,
  { status: 'internal_review', note: 'Reviewed by smoke workflow.' },
);
assert.equal(reviewedReport.status, 'internal_review');
const issuedReport = await api(
  'POST',
  `/v1/projects/${project.id}/workflows/${report.id}/transitions`,
  {
    status: 'issued',
    note: 'Issued by smoke workflow.',
  },
);
assert.equal(issuedReport.status, 'issued');
const acknowledgedReport = await api(
  'POST',
  `/v1/projects/${project.id}/workflows/${report.id}/transitions`,
  { status: 'acknowledged', note: 'Owner acknowledgement recorded by smoke workflow.' },
);
assert.equal(acknowledgedReport.status, 'acknowledged');
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
for (const eventType of [
  'workflow.issued',
  'invoice.issued',
  'payment.recorded',
  'observation.comment_added',
]) {
  assert.equal(
    notifications.some((notification) => notification.event_type === eventType),
    true,
    `Notification ${eventType} was not created.`,
  );
}
const paymentNotificationCount = notifications.filter(
  (notification) => notification.event_type === 'payment.recorded',
).length;
const mutedPaymentPreference = await api('PUT', '/v1/workspace/notification-preferences', {
  eventType: 'payment.recorded',
  inAppEnabled: false,
  emailEnabled: false,
  quietHoursStart: '18:00',
  quietHoursEnd: '08:00',
  digestFrequency: 'none',
});
assert.equal(
  mutedPaymentPreference.in_app_enabled,
  false,
  'Notification preference did not save the in-app setting.',
);
const notificationPreferences = await api('GET', '/v1/workspace/notification-preferences');
assert.equal(
  notificationPreferences.some(
    (preference) => preference.event_type === 'payment.recorded' && !preference.in_app_enabled,
  ),
  true,
  'Saved notification preference is not returned to its owner.',
);
await api('POST', `/v1/projects/${project.id}/finance/invoices/${invoice.id}/payments`, {
  amount: 1,
  paidDate: '2026-08-06',
  reference: `SMOKE-MUTED-${runId}`,
});
const notificationsAfterMutedPayment = await api('GET', '/v1/workspace/notifications');
assert.equal(
  notificationsAfterMutedPayment.filter(
    (notification) => notification.event_type === 'payment.recorded',
  ).length,
  paymentNotificationCount,
  'A muted payment notification was delivered in-app.',
);
const taskNotificationCount = notificationsAfterMutedPayment.filter(
  (notification) => notification.event_type === 'task.assigned',
).length;
await api('PUT', '/v1/workspace/notification-preferences', {
  eventType: 'task.assigned',
  inAppEnabled: false,
  emailEnabled: false,
  digestFrequency: 'none',
});
await api('POST', `${projectPath}/tasks`, {
  title: `Muted task assignment ${runId}`,
  assigneeId: identity.userId,
});
const notificationsAfterMutedTask = await api('GET', '/v1/workspace/notifications');
assert.equal(
  notificationsAfterMutedTask.filter((notification) => notification.event_type === 'task.assigned')
    .length,
  taskNotificationCount,
  'A muted task-assignment notification was delivered in-app.',
);
const workflowNotificationCount = notificationsAfterMutedPayment.filter(
  (notification) => notification.event_type === 'workflow.issued',
).length;
await api('PUT', '/v1/workspace/notification-preferences', {
  eventType: 'workflow.issued',
  inAppEnabled: true,
  emailEnabled: false,
  quietHoursStart: '00:00',
  quietHoursEnd: '23:59',
  digestFrequency: 'immediate',
});
const quietWorkflow = await api('POST', `/v1/projects/${project.id}/workflows`, {
  recordType: 'rfi',
  title: `Quiet-hours workflow ${runId}`,
});
await api('POST', `/v1/projects/${project.id}/workflows/${quietWorkflow.id}/transitions`, {
  status: 'issued',
});
const notificationsDuringQuietHours = await api('GET', '/v1/workspace/notifications');
assert.equal(
  notificationsDuringQuietHours.filter(
    (notification) => notification.event_type === 'workflow.issued',
  ).length,
  workflowNotificationCount,
  'A quiet-hours notification was visible before its configured end time.',
);
const finance = await api('GET', `/v1/projects/${project.id}/finance`);
assert.equal(
  finance.health.paid >= Number(issuedInvoice.total),
  true,
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
const feedback = await api('POST', `/v1/projects/${project.id}/brain/drafts/${draft.id}/feedback`, {
  rating: 'incomplete',
  correction: 'Include the façade drawing revision in the response.',
});
assert.equal(feedback.rating, 'incomplete', 'AI feedback was not retained.');
const classificationDraft = await api('POST', `/v1/projects/${project.id}/brain/drafts`, {
  intent: 'document_classification',
  prompt: `Classify the smoke facade report ${runId}`,
});
const rejectedDraft = await api(
  'POST',
  `/v1/projects/${project.id}/brain/drafts/${classificationDraft.id}/reject`,
);
assert.equal(rejectedDraft.status, 'rejected');
const disposableDraft = await api('POST', `/v1/projects/${project.id}/brain/drafts`, {
  intent: 'risk_summary',
  prompt: `Prepare a disposable risk summary for smoke ${runId}`,
});
const aiExport = await api('GET', '/v1/ai/records/export');
assert.equal(aiExport.format, 'orbita-ai-records/v1', 'AI records export format is missing.');
assert.equal(
  aiExport.drafts.some((item) => item.id === disposableDraft.id),
  true,
  'AI records export omits the generated draft.',
);
assert.equal(
  aiExport.feedback.some((item) => item.draft_id === draft.id && item.rating === 'incomplete'),
  true,
  'AI records export omits the recorded feedback.',
);
const deletedDraft = await api(
  'DELETE',
  `/v1/projects/${project.id}/brain/drafts/${disposableDraft.id}`,
);
assert.equal(deletedDraft.deleted, true, 'AI draft deletion was not confirmed.');

const projectRecord = await api('GET', `${projectPath}/record`);
assert.equal(
  projectRecord.transmittals.some((item) => item.id === transmittal.id),
  true,
  'Project record does not include the transmittal receipt.',
);
assert.equal(
  projectRecord.documents.find((item) => item.revision === 'A')?.status,
  'superseded',
  'Issued document revision was not superseded.',
);
assert.equal(
  projectRecord.documents.find((item) => item.revision === 'A')?.zone,
  'Facade east',
  'Drawing location metadata was not retained.',
);
assert.match(
  projectRecord.documents.find((item) => item.document_number === `UP-${runId}`.toUpperCase())
    ?.content_sha256,
  /^[a-f0-9]{64}$/,
  'Attached document checksum was not retained.',
);
const projectExport = await apiText(`/v1/projects/${project.id}/exports/project.csv`);
assert.match(projectExport, /Facade observation/);
const commercialExport = await apiText(`/v1/projects/${project.id}/exports/commercial.csv`);
assert.match(commercialExport, /Amount \(INR\)/);
const projectPackage = await api('GET', `/v1/projects/${project.id}/exports/project.json`);
assert.equal(
  projectPackage.format,
  'orbita-project-record/v1',
  'Project package format is missing.',
);
assert.equal(projectPackage.project.id, project.id, 'Project package has the wrong project.');
assert.equal(
  projectPackage.transmittals.some((item) => item.id === transmittal.id),
  true,
  'Project package does not include the transmittal receipt.',
);
assert.equal(
  projectPackage.observations.some((item) =>
    item.evidence.some((evidence) => evidence.label === `A-502 parapet detail ${runId}`),
  ),
  true,
  'Project package does not retain structured observation evidence.',
);
assert.equal(
  projectPackage.documents.some((item) => item.storage_key !== undefined),
  false,
);
assert.ok(
  projectPackage.attachmentNotice,
  'Project package does not describe original-file handling.',
);
const auditEvents = await api('GET', `/v1/workspace/audit?projectId=${project.id}`);
for (const action of [
  'observation.captured',
  'workflow.transitioned',
  'finance.invoice_status_changed',
  'finance.payment_recorded',
  'cost.change_status_changed',
  'project.status_changed',
  'project.stage_changed',
  'project.collaborator_removed',
  'task.status_changed',
  'project.search_performed',
  'export.project_csv_created',
  'export.commercial_csv_created',
  'export.project_package_created',
  'document.upload_attached',
  'document.download_prepared',
  'document.upload_batch_prepared',
  'ai.draft_deleted',
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
assert.equal(
  organizationAudit.some((event) => event.action === 'pipeline.opportunity_converted'),
  true,
  'Opportunity conversion was not recorded in organization audit.',
);
assert.equal(
  organizationAudit.some((event) => event.action === 'contact.project_linked'),
  true,
  'Contact project relationship was not recorded in organization audit.',
);
assert.equal(
  organizationAudit.some((event) => event.action === 'project.collaborator_removed'),
  true,
  'Collaborator removal was not recorded in organization audit.',
);
const closedProject = await api('POST', `${projectPath}/status`, { status: 'closed' });
assert.equal(closedProject.status, 'closed', 'Project did not transition to closed.');
assert.ok(closedProject.retention_until, 'Closing a project did not set the retention date.');
console.log(`Phase 1 smoke passed for ${project.code} (${project.id}).`);
