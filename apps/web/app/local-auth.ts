export type Viewer = { userId: string; organizationId: string; roles: string[] };
export type ConnectedWorkspace = {
  organizationId: string;
  projects: { id: string; code: string; name: string; status: string }[];
  teams: { id: string; name: string }[];
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
  }[];
  communications: {
    id: string;
    channel: string;
    subject: string;
    sender: string;
    filed_at: string;
  }[];
};
export type FinanceControl = {
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

const tokenKey = 'orbita.access-token';
const verifierKey = 'orbita.pkce-verifier';
const issuer = process.env.NEXT_PUBLIC_KEYCLOAK_ISSUER ?? 'http://localhost:8180/realms/orbita';
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

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
  window.location.assign(`${issuer}/protocol/openid-connect/auth?${query.toString()}`);
}

export async function restoreLocalLogin(): Promise<Viewer | undefined> {
  const query = new URLSearchParams(window.location.search);
  const code = query.get('code');
  if (code) {
    const verifier = sessionStorage.getItem(verifierKey);
    if (!verifier) throw new Error('The local sign-in request expired. Please try again.');
    const redirectUri = `${window.location.origin}${window.location.pathname}`;
    const response = await fetch(`${issuer}/protocol/openid-connect/token`, {
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
  const response = await fetch(`${apiUrl}/v1/me`, {
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
  const response = await fetch(`${apiUrl}/v1/workspace`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Workspace data could not be loaded.');
  return response.json() as Promise<ConnectedWorkspace>;
}

async function apiGet<T>(path: string): Promise<T> {
  const token = sessionStorage.getItem(tokenKey);
  if (!token) throw new Error('Sign in is required to load project data.');
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error('Project data could not be loaded.');
  return response.json() as Promise<T>;
}

export const loadProjectRecord = (projectId: string) =>
  apiGet<ProjectRecord>(`/v1/workspace/projects/${projectId}/record`);
export const loadFinanceControl = (projectId: string) =>
  apiGet<FinanceControl>(`/v1/projects/${projectId}/finance`);
export const loadCostControl = (projectId: string) =>
  apiGet<CostControl>(`/v1/projects/${projectId}/finance/cost`);
export const loadExecutionRegister = (projectId: string) =>
  apiGet<ExecutionRegister>(`/v1/projects/${projectId}/execution-register`);
