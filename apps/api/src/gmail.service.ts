import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';

interface ConnectionRow extends QueryResultRow {
  id: string;
  mailbox: string | null;
  scopes: string[];
  status: string;
  connected_at: Date | null;
}
interface StateRow extends QueryResultRow {
  id: string;
  organization_id: string;
  actor_id: string;
  expires_at: Date;
}

const gmailScopes = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
];

@Injectable()
export class GmailService {
  constructor(private readonly pool: DatabaseService) {}
  async list(actor: AuthenticatedActor) {
    const result = await this.pool.query<ConnectionRow>(
      'SELECT id, mailbox, scopes, status, connected_at FROM integration_connections WHERE organization_id = $1 AND provider = $2 ORDER BY created_at DESC',
      [actor.organizationId, 'gmail'],
    );
    return result.rows;
  }
  async start(actor: AuthenticatedActor) {
    this.requireAdmin(actor);
    const config = this.config();
    await this.ensureOrganization(actor);
    const state = randomUUID();
    await this.pool.query(
      "INSERT INTO integration_oauth_states (id, organization_id, actor_id, provider, expires_at) VALUES ($1,$2,$3,$4,NOW() + INTERVAL '10 minutes')",
      [state, actor.organizationId, actor.userId, 'gmail'],
    );
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      include_granted_scopes: 'true',
      state,
      scope: gmailScopes.join(' '),
    });
    return {
      authorizationUrl: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      stateExpiresInMinutes: 10,
      scopes: gmailScopes,
    };
  }
  async complete(code: string, state: string) {
    const config = this.config();
    const states = await this.pool.query<StateRow>(
      'DELETE FROM integration_oauth_states WHERE id = $1 AND provider = $2 AND expires_at > NOW() RETURNING id, organization_id, actor_id, expires_at',
      [state, 'gmail'],
    );
    const oauth = row(states.rows, 'OAuth state is invalid or expired.');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    if (!response.ok) throw new BadRequestException('Gmail authorization exchange failed.');
    const tokens = (await response.json()) as { refresh_token?: string; access_token?: string };
    if (!tokens.refresh_token)
      throw new BadRequestException(
        'Gmail did not return a refresh token; reconnect with consent.',
      );
    const profileResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileResponse.ok) throw new BadRequestException('Gmail profile lookup failed.');
    const profile = (await profileResponse.json()) as { emailAddress?: string };
    const mailbox = profile.emailAddress;
    if (!mailbox) throw new BadRequestException('Gmail did not return a mailbox address.');
    const connection = await this.pool.query<ConnectionRow>(
      'INSERT INTO integration_connections (organization_id, provider, mailbox, scopes, encrypted_refresh_token, status, connected_by, connected_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT (organization_id, provider, mailbox) DO UPDATE SET scopes = EXCLUDED.scopes, encrypted_refresh_token = EXCLUDED.encrypted_refresh_token, status = EXCLUDED.status, connected_by = EXCLUDED.connected_by, connected_at = NOW() RETURNING id, mailbox, scopes, status, connected_at',
      [
        oauth.organization_id,
        'gmail',
        mailbox,
        gmailScopes,
        this.encrypt(tokens.refresh_token),
        'connected',
        oauth.actor_id,
      ],
    );
    return row(connection.rows, 'Gmail connection could not be saved.');
  }
  async disconnect(actor: AuthenticatedActor, connectionId: string) {
    this.requireAdmin(actor);
    const result = await this.pool.query<ConnectionRow>(
      'UPDATE integration_connections SET status = $1, encrypted_refresh_token = NULL WHERE id = $2 AND organization_id = $3 AND provider = $4 RETURNING id, mailbox, scopes, status, connected_at',
      ['disconnected', connectionId, actor.organizationId, 'gmail'],
    );
    return row(result.rows, 'Gmail connection is unavailable.');
  }
  private config() {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const redirectUri = process.env.GMAIL_REDIRECT_URI;
    if (!clientId || !clientSecret || !redirectUri)
      throw new BadRequestException(
        'Gmail OAuth is not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REDIRECT_URI.',
      );
    if (!process.env.INTEGRATION_TOKEN_KEY)
      throw new BadRequestException(
        'INTEGRATION_TOKEN_KEY is required before mailbox credentials can be stored.',
      );
    return { clientId, clientSecret, redirectUri };
  }
  private encrypt(value: string) {
    const key = createHash('sha256').update(process.env.INTEGRATION_TOKEN_KEY!).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }
  // Kept alongside encryption so future Gmail sync workers must use the same authenticated format.
  private decrypt(payload: string) {
    const [iv, tag, encrypted] = payload.split('.');
    if (!iv || !tag || !encrypted)
      throw new BadRequestException('Stored Gmail credential is invalid.');
    const decipher = createDecipheriv(
      'aes-256-gcm',
      createHash('sha256').update(process.env.INTEGRATION_TOKEN_KEY!).digest(),
      Buffer.from(iv, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }
  private requireAdmin(actor: AuthenticatedActor) {
    if (!actor.roles.some((role) => ['organization_admin', 'principal'].includes(role)))
      throw new BadRequestException('Organization administrator permission is required.');
  }
  private async ensureOrganization(actor: AuthenticatedActor) {
    await this.pool.query(
      'INSERT INTO organizations (id, name) VALUES ($1,$1) ON CONFLICT (id) DO NOTHING',
      [actor.organizationId],
    );
  }
}
const row = <T extends QueryResultRow>(rows: T[], message: string) => {
  const value = rows[0];
  if (!value) throw new BadRequestException(message);
  return value;
};
