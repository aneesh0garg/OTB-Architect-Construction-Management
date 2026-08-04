export type Viewer = {
  userId: string;
  organizationId: string;
  roles: string[];
  displayName?: string;
  email?: string;
};
export type ConnectedWorkspace = {
  organizationId: string;
  projects: { id: string; code: string; name: string; status: string }[];
  teams: { id: string; name: string }[];
};
export type PipelineOpportunity = {
  id: string;
  client_name: string;
  project_name: string;
  stage: string;
  probability: number;
  anticipated_fee: string;
  next_action: string | null;
  proposals: { id: string; version: number; status: string; fee: string }[];
};
export type PipelineRegister = { opportunities: PipelineOpportunity[] };
export type ResourcePerson = {
  user_id: string;
  display_name: string;
  title: string | null;
  weekly_capacity_hours: number;
  active: boolean;
};
export type ResourceTeam = {
  id: string;
  name: string;
  members: Array<{ user_id: string; display_name: string; title: string | null; role: string }>;
};
export type CapacityRegister = {
  from: string;
  to: string;
  people: Array<
    ResourcePerson & {
      capacityHours: number;
      allocatedHours: number;
      availableHours: number;
      utilization: number;
    }
  >;
};
export type ProjectRecord = {
  project: {
    id: string;
    code: string;
    name: string;
    status: string;
    location: string | null;
    stage: string;
  };
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    assignee_id: string | null;
  }[];
  documents: {
    id: string;
    document_number: string;
    document_type: string;
    title: string;
    revision: string;
    status: string;
    issue_date: string | null;
    discipline: string | null;
    building: string | null;
    floor: string | null;
    zone: string | null;
    has_original: boolean;
  }[];
  communications: {
    id: string;
    channel: string;
    direction: string;
    subject: string;
    body: string;
    sender: string;
    recipients: string[];
    filed_at: string;
  }[];
  members: {
    user_id: string;
    role: string;
    display_name: string | null;
    title: string | null;
  }[];
};
export type FinanceControl = {
  phases: { id: string; name: string; planned_fee: string; target_hours: number }[];
  invoices: {
    id: string;
    invoice_number: number;
    status: string;
    subtotal: string;
    gst_amount: string;
    total: string;
    due_date: string | null;
    accounting_sync_status: string;
  }[];
  payments: { id: string; amount: string; paid_date: string; reference: string | null }[];
  health: {
    plannedFee: number;
    targetHours: number;
    loggedHours: number;
    invoiced: number;
    paid: number;
    outstanding: number;
    feeBurn: number;
    hoursBurn: number;
  };
};
export type CostControl = {
  budgets: { id: string; cost_code: string; name: string; amount: string }[];
  commitments: {
    id: string;
    vendor_name: string;
    description: string;
    original_amount: string;
    approved_amount: string;
    status: string;
  }[];
  changeEvents: { id: string; code: string; description: string; amount: string; status: string }[];
  health: {
    budget: number;
    committed: number;
    approvedChanges: number;
    forecastAtCompletion: number;
    uncommittedBudget: number;
    forecastVariance: number;
  };
};
export type ExecutionRegister = {
  observations: {
    id: string;
    observation_number: string;
    title: string;
    priority: string;
    status: string;
    sync_state: string;
  }[];
};
export type DocumentDownload = {
  downloadUrl: string;
  expiresAt: string;
};
export type NotificationPreference = {
  event_type: string;
  in_app_enabled: boolean;
  email_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
  digest_frequency: 'immediate' | 'daily' | 'weekly' | 'none';
  updated_at: string;
};
export type NotificationPreferenceInput = {
  eventType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  digestFrequency: NotificationPreference['digest_frequency'];
};
export type AiCitation = {
  source_type: string;
  source_id: string;
  title: string;
  excerpt: string;
  created_at: string;
};
export type AiSearchResult = { query: string; citations: AiCitation[]; notice: string };
export type AiDraft = {
  id: string;
  intent: string;
  content: string;
  citations: AiCitation[];
  status: 'review_required' | 'approved' | 'rejected';
  model: string;
};
export type WorkspaceNotification = {
  id: string;
  event_type: string;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};
export type DocumentAnnotation = {
  id: string;
  page_number: number;
  x_percent: number | null;
  y_percent: number | null;
  body: string;
  created_by: string;
  created_at: string;
};

const tokenKey = 'orbita.access-token';
const verifierKey = 'orbita.pkce-verifier';
const configuredIssuer =
  process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? 'http://localhost:8180/realms/orbita';
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

const localServiceUrl = (configuredUrl: string) => {
  const url = new URL(configuredUrl);
  // On a phone, localhost points to the phone itself. Keep explicit remote
  // endpoints intact, but follow the web app's LAN hostname for local services.
  if (typeof window !== 'undefined' && url.hostname === 'localhost') {
    url.hostname = window.location.hostname;
  }
  return url.toString().replace(/\/$/, '');
};

const issuerUrl = () => localServiceUrl(configuredIssuer);
const apiUrl = () => localServiceUrl(configuredApiUrl);

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

const sha256Constants = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

// PKCE needs SHA-256, but iOS browsers on a plain HTTP LAN address can omit
// crypto.subtle. This fallback hashes only the public PKCE verifier; entropy
// still comes from crypto.getRandomValues below.
const sha256Fallback = (value: string) => {
  const input = new TextEncoder().encode(value);
  const length = Math.ceil((input.length + 9) / 64) * 64;
  const data = new Uint8Array(length);
  data.set(input);
  data[input.length] = 0x80;
  new DataView(data.buffer).setUint32(length - 4, input.length * 8, false);
  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;
  const words = new Uint32Array(64);
  const view = new DataView(data.buffer);
  for (let offset = 0; offset < data.length; offset += 64) {
    for (let index = 0; index < 16; index += 1)
      words[index] = view.getUint32(offset + index * 4, false);
    for (let index = 16; index < 64; index += 1) {
      const w15 = words[index - 15]!;
      const w2 = words[index - 2]!;
      const s0 = ((w15 >>> 7) | (w15 << 25)) ^ ((w15 >>> 18) | (w15 << 14)) ^ (w15 >>> 3);
      const s1 = ((w2 >>> 17) | (w2 << 15)) ^ ((w2 >>> 19) | (w2 << 13)) ^ (w2 >>> 10);
      words[index] = (words[index - 16]! + s0 + words[index - 7]! + s1) >>> 0;
    }
    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;
    for (let index = 0; index < 64; index += 1) {
      const s1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const choice = (e & f) ^ (~e & g);
      const temp1 = (h + s1 + choice + sha256Constants[index]! + words[index]!) >>> 0;
      const s0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (s0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }
  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  [h0, h1, h2, h3, h4, h5, h6, h7].forEach((word, index) =>
    digestView.setUint32(index * 4, word, false),
  );
  return digest;
};

const pkceDigest = async (verifier: string) =>
  globalThis.crypto?.subtle?.digest
    ? new Uint8Array(
        await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
      )
    : sha256Fallback(verifier);

export async function beginLocalLogin() {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error(
      'Secure random values are unavailable in this browser. Open the workspace over HTTPS.',
    );
  }
  const verifier = base64Url(cryptoApi.getRandomValues(new Uint8Array(48)));
  const digest = await pkceDigest(verifier);
  sessionStorage.setItem(verifierKey, verifier);
  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const query = new URLSearchParams({
    client_id: 'orbita-web',
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid profile email',
    code_challenge: base64Url(new Uint8Array(digest)),
    code_challenge_method: 'S256',
  });
  window.location.assign(`${issuerUrl()}/protocol/openid-connect/auth?${query.toString()}`);
}

export async function restoreLocalLogin(): Promise<Viewer | undefined> {
  const query = new URLSearchParams(window.location.search);
  const code = query.get('code');
  if (code) {
    const verifier = sessionStorage.getItem(verifierKey);
    if (!verifier) throw new Error('The local sign-in request expired. Please try again.');
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const response = await fetch(`${issuerUrl()}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: 'orbita-web',
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    if (!response.ok) throw new Error('Local sign-in could not be completed.');
    const tokens = (await response.json()) as { access_token?: string };
    if (!tokens.access_token)
      throw new Error('The identity provider did not return an access token.');
    sessionStorage.setItem(tokenKey, tokens.access_token);
    sessionStorage.removeItem(verifierKey);
    window.history.replaceState({}, '', redirectUri);
  }
  const token = sessionStorage.getItem(tokenKey);
  if (!token) return undefined;
  const response = await fetch(`${apiUrl()}/v1/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    sessionStorage.removeItem(tokenKey);
    throw new Error('Your local session has expired.');
  }
  return response.json() as Promise<Viewer>;
}

export function signOutLocal() {
  sessionStorage.removeItem(tokenKey);
  sessionStorage.removeItem(verifierKey);
}

export async function loadConnectedWorkspace(): Promise<ConnectedWorkspace> {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) throw new Error('Sign in is required to load workspace data.');
  const response = await fetch(`${apiUrl()}/v1/workspace`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Workspace data could not be loaded.');
  return response.json() as Promise<ConnectedWorkspace>;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) throw new Error('Sign in is required to load project data.');
  const response = await fetch(`${apiUrl()}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Project data could not be loaded.');
  return response.json() as Promise<T>;
}

async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) throw new Error('Sign in is required to change notification settings.');
  const response = await fetch(`${apiUrl()}${path}`, {
    method: 'PUT',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error('Notification settings could not be saved.');
  return response.json() as Promise<T>;
}

async function apiPost<T>(
  path: string,
  body?: unknown,
  failureMessage = 'Project Brain could not complete this request.',
): Promise<T> {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) throw new Error('Sign in is required to use Project Brain.');
  const response = await fetch(`${apiUrl()}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => undefined);
    throw new Error(payload?.message ?? failureMessage);
  }
  return response.json() as Promise<T>;
}

export const loadProjectRecord = (projectId: string) =>
  apiGet<ProjectRecord>(`/v1/workspace/projects/${projectId}/record`);
export const transitionWorkspaceProjectStatus = (projectId: string, status: string) =>
  apiPost(`/v1/workspace/projects/${projectId}/status`, { status });
export const transitionWorkspaceProjectStage = (projectId: string, stage: string) =>
  apiPost(`/v1/workspace/projects/${projectId}/stage`, { stage });
export const createFieldObservation = (
  projectId: string,
  input: { title: string; location?: string; priority?: string },
) => apiPost(`/v1/projects/${projectId}/observations`, input);
export const createWorkspaceTeam = (name: string) => apiPost('/v1/workspace/teams', { name });
export const createWorkspaceProject = (input: {
  code: string;
  name: string;
  location?: string;
  stage?: string;
}) => apiPost<{ id: string; code: string; name: string }>('/v1/workspace/projects', input);
export const loadPipeline = () => apiGet<PipelineRegister>('/v1/pipeline');
export const createPipelineOpportunity = (input: {
  clientName: string;
  projectName: string;
  anticipatedFee?: number;
  nextAction?: string;
}) => apiPost('/v1/pipeline/opportunities', input);
export const createPipelineProposal = (
  opportunityId: string,
  input: { scope: string; fee: number },
) =>
  apiPost(`/v1/pipeline/opportunities/${opportunityId}/proposals`, {
    ...input,
    phases: [{ name: 'Base services', plannedFee: input.fee, targetHours: 1 }],
  });
export const convertPipelineOpportunity = (
  opportunityId: string,
  input: { proposalId: string; projectCode: string; location?: string },
) => apiPost(`/v1/pipeline/opportunities/${opportunityId}/convert`, input);
export const loadResourcePeople = () => apiGet<ResourcePerson[]>('/v1/resources/people');
export const loadResourceTeams = () => apiGet<ResourceTeam[]>('/v1/resources/teams');
export const loadResourceCapacity = (from: string, to: string) =>
  apiGet<CapacityRegister>(
    `/v1/resources/capacity?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
  );
export const saveResourcePerson = (input: {
  userId: string;
  displayName: string;
  title?: string;
  weeklyCapacityHours?: number;
}) => apiPost('/v1/resources/people', input);
export const assignResourceTeamMember = (input: {
  teamId: string;
  userId: string;
  role?: string;
}) => apiPost('/v1/resources/team-members', input);
export async function uploadProjectDocument(
  projectId: string,
  file: File,
  input: {
    documentNumber: string;
    documentType: 'drawing' | 'specification' | 'report' | 'contract' | 'photo' | 'other';
    title: string;
    revision: string;
  },
) {
  const prepared = await apiPost<{ uploadId: string; uploadUrl: string }>(
    `/v1/workspace/projects/${projectId}/documents/uploads`,
    { fileName: file.name, contentType: file.type, size: file.size },
    'Document upload could not be prepared.',
  );
  let uploaded: Response;
  try {
    uploaded = await fetch(prepared.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': file.type },
      body: file,
    });
  } catch {
    throw new Error(
      'Browser upload could not reach document storage. Check the local network configuration.',
    );
  }
  if (!uploaded.ok) throw new Error('The selected file could not be uploaded.');
  await apiPost(
    `/v1/workspace/projects/${projectId}/documents/uploads/${prepared.uploadId}/complete`,
    undefined,
    'Document upload verification failed.',
  );
  return apiPost(
    `/v1/workspace/projects/${projectId}/documents`,
    {
      ...input,
      uploadId: prepared.uploadId,
    },
    'Document revision could not be created.',
  );
}
export const issueProjectDocument = (projectId: string, documentId: string) =>
  apiPost(`/v1/workspace/projects/${projectId}/documents/${documentId}/issue`);
export const createProjectTask = (
  projectId: string,
  input: { title: string; priority?: string; dueDate?: string; assigneeId?: string },
) => apiPost(`/v1/workspace/projects/${projectId}/tasks`, input);
export const transitionProjectTask = (
  projectId: string,
  taskId: string,
  status: 'in_progress' | 'blocked' | 'completed' | 'cancelled',
) => apiPost(`/v1/workspace/projects/${projectId}/tasks/${taskId}/status`, { status });
export const createProjectBudget = (
  projectId: string,
  input: { costCode: string; name: string; amount: number },
) => apiPost(`/v1/projects/${projectId}/finance/budgets`, input);
export const createProjectCommitment = (
  projectId: string,
  input: { vendorName: string; description: string; originalAmount: number },
) => apiPost(`/v1/projects/${projectId}/finance/commitments`, input);
export const createProjectChangeEvent = (
  projectId: string,
  input: { code: string; description: string; amount: number },
) => apiPost(`/v1/projects/${projectId}/finance/change-events`, input);
export const createProjectInvoice = (
  projectId: string,
  input: { clientName: string; dueDate?: string; gstRate?: number; lines: unknown[] },
) => apiPost(`/v1/projects/${projectId}/finance/invoices`, input);
export const recordProjectPayment = (
  projectId: string,
  invoiceId: string,
  input: { amount: number; paidDate: string; reference?: string },
) => apiPost(`/v1/projects/${projectId}/finance/invoices/${invoiceId}/payments`, input);
export const transitionProjectInvoice = (projectId: string, invoiceId: string, status: string) =>
  apiPost(`/v1/projects/${projectId}/finance/invoices/${invoiceId}/status`, { status });
export const fileProjectCommunication = (
  projectId: string,
  input: {
    channel: 'email' | 'whatsapp_business' | 'manual_note';
    direction: 'inbound' | 'outbound' | 'internal';
    subject: string;
    body: string;
    sender: string;
    recipients: string[];
  },
) => apiPost(`/v1/workspace/projects/${projectId}/communications`, input);
export const loadFinanceControl = (projectId: string) =>
  apiGet<FinanceControl>(`/v1/projects/${projectId}/finance`);
export const loadCostControl = (projectId: string) =>
  apiGet<CostControl>(`/v1/projects/${projectId}/finance/cost`);
export const loadExecutionRegister = (projectId: string) =>
  apiGet<ExecutionRegister>(`/v1/projects/${projectId}/execution-register`);
export const prepareDocumentDownload = (projectId: string, documentId: string) =>
  apiGet<DocumentDownload>(`/v1/workspace/projects/${projectId}/documents/${documentId}/download`);
export const loadNotificationPreferences = () =>
  apiGet<NotificationPreference[]>('/v1/workspace/notification-preferences');
export const saveNotificationPreference = (input: NotificationPreferenceInput) =>
  apiPut<NotificationPreference>('/v1/workspace/notification-preferences', input);
export const searchProjectBrain = (projectId: string, query: string) =>
  apiGet<AiSearchResult>(`/v1/projects/${projectId}/brain/search?q=${encodeURIComponent(query)}`);
export const createProjectBrainDraft = (
  projectId: string,
  input: { intent: AiDraft['intent']; prompt: string },
) => apiPost<AiDraft>(`/v1/projects/${projectId}/brain/drafts`, input);
export const reviewProjectBrainDraft = (
  projectId: string,
  draftId: string,
  decision: 'approve' | 'reject',
) => apiPost<AiDraft>(`/v1/projects/${projectId}/brain/drafts/${draftId}/${decision}`);
export const loadNotifications = () =>
  apiGet<WorkspaceNotification[]>('/v1/workspace/notifications');
export const markNotificationRead = (notificationId: string) =>
  apiPost<WorkspaceNotification>(`/v1/workspace/notifications/${notificationId}/read`);
export const loadDocumentAnnotations = (projectId: string, documentId: string) =>
  apiGet<DocumentAnnotation[]>(
    `/v1/workspace/projects/${projectId}/documents/${documentId}/annotations`,
  );
export const createDocumentAnnotation = (
  projectId: string,
  documentId: string,
  input: { body: string; pageNumber?: number; xPercent?: number; yPercent?: number },
) =>
  apiPost<DocumentAnnotation>(
    `/v1/workspace/projects/${projectId}/documents/${documentId}/annotations`,
    input,
  );
