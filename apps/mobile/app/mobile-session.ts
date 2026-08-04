import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const sessionKey = 'orbita.mobile.session.v1';
const issuer = process.env.EXPO_PUBLIC_KEYCLOAK_ISSUER;
const apiUrl = process.env.EXPO_PUBLIC_API_URL;
const redirectUri = AuthSession.makeRedirectUri({ scheme: 'orbita', path: 'auth' });

export interface MobileSession {
  accessToken: string;
  refreshToken?: string | undefined;
  expiresAt: number;
  projectId: string;
  projectName: string;
}

interface WorkspaceResponse {
  projects: Array<{ id: string; name: string }>;
}

function discovery() {
  if (!issuer) throw new Error('EXPO_PUBLIC_KEYCLOAK_ISSUER is not configured.');
  return {
    authorizationEndpoint: `${issuer}/protocol/openid-connect/auth`,
    tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
  };
}

function requiredApiUrl() {
  if (!apiUrl) throw new Error('EXPO_PUBLIC_API_URL is not configured.');
  return apiUrl.replace(/\/$/, '');
}

export async function restoreSession() {
  const stored = await SecureStore.getItemAsync(sessionKey);
  if (!stored) return undefined;
  try {
    const session = JSON.parse(stored) as MobileSession;
    if (session.expiresAt > Date.now()) return session;
    if (!session.refreshToken) {
      await SecureStore.deleteItemAsync(sessionKey);
      return undefined;
    }
    const refreshed = await AuthSession.refreshAsync(
      { clientId: 'orbita-mobile', refreshToken: session.refreshToken },
      discovery(),
    );
    if (!refreshed.accessToken) throw new Error('Keycloak did not refresh the mobile session.');
    const renewed: MobileSession = {
      ...session,
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? session.refreshToken,
      expiresAt: Date.now() + (refreshed.expiresIn ?? 300) * 1000,
    };
    await SecureStore.setItemAsync(sessionKey, JSON.stringify(renewed));
    return renewed;
  } catch {
    await SecureStore.deleteItemAsync(sessionKey);
    return undefined;
  }
}

export async function signIn() {
  const request = new AuthSession.AuthRequest({
    clientId: 'orbita-mobile',
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    scopes: ['openid', 'profile'],
    usePKCE: true,
  });
  const result = await request.promptAsync(discovery());
  if (result.type !== 'success' || !result.params.code) return undefined;
  const token = await AuthSession.exchangeCodeAsync(
    {
      clientId: 'orbita-mobile',
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier ?? '' },
    },
    discovery(),
  );
  if (!token.accessToken) throw new Error('Keycloak did not return an access token.');
  const workspaceResponse = await fetch(`${requiredApiUrl()}/v1/workspace`, {
    headers: { authorization: `Bearer ${token.accessToken}` },
  });
  if (!workspaceResponse.ok) throw new Error('The workspace could not be loaded.');
  const workspace = (await workspaceResponse.json()) as WorkspaceResponse;
  const project = workspace.projects[0];
  if (!project) throw new Error('Create or join a project before using Field work.');
  const session: MobileSession = {
    accessToken: token.accessToken,
    refreshToken: token.refreshToken,
    expiresAt: Date.now() + (token.expiresIn ?? 300) * 1000,
    projectId: project.id,
    projectName: project.name,
  };
  await SecureStore.setItemAsync(sessionKey, JSON.stringify(session));
  return session;
}

export async function signOut() {
  await SecureStore.deleteItemAsync(sessionKey);
}

export async function submitObservation(
  session: MobileSession,
  input: {
    id: string;
    title: string;
    area: string;
    priority: 'High' | 'Medium' | 'Low';
  },
) {
  const response = await fetch(
    `${requiredApiUrl()}/v1/projects/${session.projectId}/observations`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        clientCaptureId: input.id,
        title: input.title,
        description: 'Captured from the Orbita field mobile application.',
        location: input.area,
        priority: input.priority === 'High' ? 'high' : input.priority === 'Low' ? 'low' : 'normal',
        syncState: 'synced',
      }),
    },
  );
  if (!response.ok) throw new Error('The observation could not be synced.');
  return response.json() as Promise<{ id: string }>;
}

export async function submitFieldVisit(
  session: MobileSession,
  input: {
    id: string;
    visitDate: string;
    location: string;
    attendees: string[];
    weather: string;
    checklist: string[];
    notes: string;
  },
) {
  const response = await fetch(
    `${requiredApiUrl()}/v1/projects/${session.projectId}/field-visits`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        clientCaptureId: input.id,
        visitDate: input.visitDate,
        location: input.location,
        attendees: input.attendees,
        weather: input.weather || undefined,
        checklist: input.checklist.map((label) => ({ label, complete: false })),
        notes: input.notes || undefined,
        syncState: 'synced',
      }),
    },
  );
  if (!response.ok) throw new Error('The field visit could not be synced.');
  return response.json() as Promise<{ id: string }>;
}

export async function createObservationTask(
  session: MobileSession,
  input: {
    observationId: string;
    title: string;
    priority: 'High' | 'Medium' | 'Low';
  },
) {
  const response = await fetch(
    `${requiredApiUrl()}/v1/workspace/projects/${session.projectId}/tasks`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: `Follow up: ${input.title}`,
        priority: input.priority === 'High' ? 'high' : input.priority === 'Low' ? 'low' : 'normal',
        sourceRecordType: 'observation',
        sourceRecordId: input.observationId,
      }),
    },
  );
  if (!response.ok) throw new Error('The observation task could not be created.');
  return response.json() as Promise<{ id: string; title: string; status: string }>;
}

export async function createObservationWorkflow(
  session: MobileSession,
  input: {
    observationId: string;
    observationTitle: string;
    type: 'rfi' | 'site_instruction';
  },
) {
  const label = input.type === 'rfi' ? 'RFI' : 'Site instruction';
  const response = await fetch(`${requiredApiUrl()}/v1/projects/${session.projectId}/workflows`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      recordType: input.type,
      title: `${label}: ${input.observationTitle}`,
      data: {
        sourceRecordType: 'observation',
        sourceObservationId: input.observationId,
        preparedFrom: 'mobile_field_capture',
      },
    }),
  });
  if (!response.ok) throw new Error(`The ${label.toLowerCase()} draft could not be created.`);
  return response.json() as Promise<{ id: string; status: string }>;
}

export async function createSiteVisitReport(
  session: MobileSession,
  input: { visitId: string; visitDate: string; location: string; observationIds: string[] },
) {
  const response = await fetch(`${requiredApiUrl()}/v1/projects/${session.projectId}/workflows`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${session.accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      recordType: 'site_visit_report',
      title: `Site visit report · ${input.visitDate} · ${input.location}`,
      data: {
        fieldVisitId: input.visitId,
        observationIds: input.observationIds,
        generatedFrom: 'mobile_field_capture',
      },
    }),
  });
  if (!response.ok) throw new Error('The site-visit report draft could not be created.');
  return response.json() as Promise<{ id: string; status: string }>;
}
