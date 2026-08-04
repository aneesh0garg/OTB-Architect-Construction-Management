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

export async function beginLocalLogin() {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
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

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
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
    throw new Error(payload?.message ?? 'Project Brain could not complete this request.');
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
  );
  const uploaded = await fetch(prepared.uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': file.type },
    body: file,
  });
  if (!uploaded.ok) throw new Error('The selected file could not be uploaded.');
  await apiPost(
    `/v1/workspace/projects/${projectId}/documents/uploads/${prepared.uploadId}/complete`,
  );
  return apiPost(`/v1/workspace/projects/${projectId}/documents`, {
    ...input,
    uploadId: prepared.uploadId,
  });
}
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
