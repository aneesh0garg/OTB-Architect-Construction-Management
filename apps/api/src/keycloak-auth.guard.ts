import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { platformRoles, type AuthenticatedActor, type PlatformRole } from '@orbita/contracts';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

type KeycloakPayload = JWTPayload & {
  realm_access?: { roles?: string[] };
  organization_id?: string;
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
    const issuer = process.env.KEYCLOAK_ISSUER;
    if (!token || !issuer)
      throw new UnauthorizedException('A bearer token and Keycloak issuer are required.');
    const keys = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
    const { payload } = await jwtVerify<KeycloakPayload>(token, keys, { issuer });
    const roles = (payload.realm_access?.roles ?? []).filter((role): role is PlatformRole =>
      platformRoles.includes(role as PlatformRole),
    );
    if (!payload.sub || !payload.organization_id || roles.length === 0)
      throw new UnauthorizedException('Missing tenant role claims.');
    request.actor = { userId: payload.sub, organizationId: payload.organization_id, roles };
    return true;
  }

  private bearerToken(header: string | string[] | undefined): string | undefined {
    const value = Array.isArray(header) ? header[0] : header;
    return value?.startsWith('Bearer ') ? value.slice(7) : undefined;
  }
}
