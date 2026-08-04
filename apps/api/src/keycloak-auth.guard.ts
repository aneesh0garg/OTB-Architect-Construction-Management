import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { platformRoles, type AuthenticatedActor, type PlatformRole } from '@orbita/contracts';
import { createRemoteJWKSet, decodeJwt, jwtVerify, type JWTPayload } from 'jose';

type KeycloakPayload = JWTPayload & {
  realm_access?: { roles?: string[] };
  organization_id?: string;
  name?: string;
  preferred_username?: string;
  email?: string;
};
export type AuthenticatedRequest = {
  headers: Record<string, string | string[] | undefined>;
  actor?: AuthenticatedActor;
};

@Injectable()
export class KeycloakAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.bearerToken(request.headers.authorization);
    const issuers = this.trustedIssuers();
    if (!token || issuers.length === 0)
      throw new UnauthorizedException('A bearer token and Keycloak issuer are required.');
    const issuer = this.tokenIssuer(token, issuers);
    const keys = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
    const { payload } = await jwtVerify<KeycloakPayload>(token, keys, { issuer });
    const roles = (payload.realm_access?.roles ?? []).filter((role): role is PlatformRole =>
      platformRoles.includes(role as PlatformRole),
    );
    if (!payload.sub || !payload.organization_id || roles.length === 0)
      throw new UnauthorizedException('Missing tenant role claims.');
    request.actor = {
      userId: payload.sub,
      organizationId: payload.organization_id,
      roles,
      ...(payload.name || payload.preferred_username
        ? { displayName: payload.name ?? payload.preferred_username }
        : {}),
      ...(payload.email ? { email: payload.email } : {}),
    };
    return true;
  }

  private bearerToken(header: string | string[] | undefined): string | undefined {
    const value = Array.isArray(header) ? header[0] : header;
    return value?.startsWith('Bearer ') ? value.slice(7) : undefined;
  }

  private trustedIssuers(): string[] {
    const configured = process.env.KEYCLOAK_ISSUERS ?? process.env.KEYCLOAK_ISSUER;
    const configuredIssuers =
      configured
        ?.split(',')
        .map((issuer) => issuer.trim())
        .filter(Boolean) ?? [];
    const lanHost = process.env.ORBITA_LAN_HOST?.trim();
    return [
      ...new Set([
        ...configuredIssuers,
        ...(lanHost ? [`http://${lanHost}:8180/realms/orbita`] : []),
      ]),
    ];
  }

  private tokenIssuer(token: string, trustedIssuers: string[]): string {
    try {
      const issuer = decodeJwt(token).iss;
      if (typeof issuer === 'string' && trustedIssuers.includes(issuer)) return issuer;
    } catch {
      // jwtVerify below would reject this too, but report an authorization error consistently.
    }
    throw new UnauthorizedException('The token issuer is not trusted.');
  }
}
