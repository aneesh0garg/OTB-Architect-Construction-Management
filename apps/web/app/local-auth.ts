export type Viewer = { userId: string; organizationId: string; roles: string[] };

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
