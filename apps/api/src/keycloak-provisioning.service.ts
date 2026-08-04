import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type KeycloakUser = { id: string };

@Injectable()
export class KeycloakProvisioningService {
  async invite(input: {
    email: string;
    displayName: string;
    organizationId: string;
  }) {
    const accessToken = await this.accessToken();
    const existing = await this.request<KeycloakUser[]>(
      `/users?email=${encodeURIComponent(input.email)}&exact=true`,
      accessToken,
    );
    const userId = existing[0]?.id ?? (await this.createUser(input, accessToken));
    await this.request<void>(
      `/users/${encodeURIComponent(userId)}/execute-actions-email?client_id=orbita-web&lifespan=604800`,
      accessToken,
      { method: 'PUT', body: JSON.stringify(['VERIFY_EMAIL', 'UPDATE_PASSWORD']) },
    );
    return { userId, isNewIdentity: existing.length === 0 };
  }

  private async createUser(input: { email: string; displayName: string; organizationId: string }, accessToken: string) {
    const [firstName, ...rest] = input.displayName.trim().split(/\s+/);
    const response = await fetch(`${this.adminBaseUrl()}/users`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        username: input.email,
        email: input.email,
        firstName,
        lastName: rest.join(' '),
        enabled: true,
        emailVerified: false,
        requiredActions: ['VERIFY_EMAIL', 'UPDATE_PASSWORD'],
        // This is only the initial local context. App memberships remain in Orbita's database.
        attributes: { organization_id: [input.organizationId] },
      }),
    });
    if (!response.ok) throw this.failure(response.status, 'Keycloak could not create the identity.');
    const location = response.headers.get('location');
    const id = location?.split('/').at(-1);
    if (!id) throw new ServiceUnavailableException('Keycloak did not return the created identity.');
    return id;
  }

  private async accessToken() {
    const clientId = process.env.KEYCLOAK_PROVISIONER_CLIENT_ID ?? 'orbita-provisioner';
    const clientSecret = process.env.KEYCLOAK_PROVISIONER_CLIENT_SECRET;
    if (!clientSecret)
      throw new ServiceUnavailableException('Member invitations are not configured. Set the Keycloak provisioner credentials.');
    const response = await fetch(`${this.realmIssuer()}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    if (!response.ok) throw this.failure(response.status, 'Keycloak provisioning authentication failed.');
    const payload = (await response.json()) as { access_token?: string };
    if (!payload.access_token) throw new ServiceUnavailableException('Keycloak did not provide a provisioner access token.');
    return payload.access_token;
  }

  private async request<T>(path: string, accessToken: string, init?: RequestInit) {
    const response = await fetch(`${this.adminBaseUrl()}${path}`, {
      ...init,
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json', ...init?.headers },
    });
    if (!response.ok) throw this.failure(response.status, 'Keycloak invitation delivery failed.');
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  private realmIssuer() {
    return (process.env.KEYCLOAK_ISSUER ?? 'http://localhost:8180/realms/orbita').replace(/\/$/, '');
  }
  private adminBaseUrl() {
    return `${this.realmIssuer().replace(/\/realms\/[^/]+$/, '')}/admin/realms/${process.env.KEYCLOAK_REALM ?? 'orbita'}`;
  }
  private failure(status: number, message: string) {
    if (status === 401 || status === 403) return new ServiceUnavailableException('Keycloak provisioner is not authorized to manage identities.');
    if (status === 400) return new BadRequestException(message);
    return new ServiceUnavailableException(message);
  }
}
