import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type { AuthenticatedActor } from '@orbita/contracts';
import { DatabaseService } from './database.service.js';
import { WorkspaceService } from './workspace.service.js';

interface ConnectionRow extends QueryResultRow {
  id: string;
  mailbox: string | null;
  scopes: string[];
  status: string;
  connected_at: Date | null;
  encrypted_refresh_token?: string | null;
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
  constructor(
    private readonly pool: DatabaseService,
    private readonly workspace: WorkspaceService,
  ) {}
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
  async messages(actor: AuthenticatedActor, connectionId: string, search?: string) {
    this.requireAdmin(actor);
    const accessToken = await this.accessToken(actor, connectionId);
    const parameters = new URLSearchParams({ maxResults: '25' });
    if (search?.trim()) parameters.set('q', search.trim());
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${parameters.toString()}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new BadRequestException('Gmail messages could not be loaded.');
    const listing = (await response.json()) as {
      messages?: Array<{ id: string; threadId: string }>;
    };
    const messages = await Promise.all(
      (listing.messages ?? []).map(async (message) => {
        const detail = await this.gmailMessage(accessToken, message.id, 'metadata');
        return this.toMessageSummary(detail);
      }),
    );
    return messages;
  }
  async fileMessage(
    actor: AuthenticatedActor,
    connectionId: string,
    messageId: string,
    projectId: string,
  ) {
    this.requireAdmin(actor);
    const accessToken = await this.accessToken(actor, connectionId);
    const message = await this.gmailMessage(accessToken, messageId, 'full');
    const headers = this.headerMap(message.payload?.headers ?? []);
    const sender = headers.get('from') ?? 'Unknown Gmail sender';
    const recipients = [headers.get('to'), headers.get('cc')]
      .filter((value): value is string => Boolean(value))
      .flatMap((value) => value.split(','))
      .map((value) => value.trim())
      .filter(Boolean);
    const connection = await this.connection(actor, connectionId);
    const direction =
      connection.mailbox && sender.includes(connection.mailbox) ? 'outbound' : 'inbound';
    return this.workspace.fileCommunication(actor, projectId, {
      channel: 'email',
      direction,
      subject: headers.get('subject') ?? '(No subject)',
      body: this.messageBody(message.payload) || message.snippet || '(No message body)',
      sender,
      recipients,
      ...(message.threadId ? { threadId: message.threadId } : {}),
      sourceMessageId: message.id,
    });
  }
  async sendMessage(
    actor: AuthenticatedActor,
    connectionId: string,
    input: { projectId: string; recipients: string[]; subject: string; body: string },
  ) {
    this.requireAdmin(actor);
    const accessToken = await this.accessToken(actor, connectionId);
    const connection = await this.connection(actor, connectionId);
    const raw = Buffer.from(
      [
        `To: ${input.recipients.join(', ')}`,
        `Subject: ${input.subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        '',
        input.body,
      ].join('\r\n'),
      'utf8',
    ).toString('base64url');
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ raw }),
    });
    if (!response.ok) throw new BadRequestException('Gmail message could not be sent.');
    const sent = (await response.json()) as GmailMessage;
    if (!sent.id) throw new BadRequestException('Gmail did not return a sent message ID.');
    return this.workspace.fileCommunication(actor, input.projectId, {
      channel: 'email',
      direction: 'outbound',
      subject: input.subject,
      body: input.body,
      sender: connection.mailbox ?? 'Connected Gmail mailbox',
      recipients: input.recipients,
      sourceMessageId: sent.id,
      ...(sent.threadId ? { threadId: sent.threadId } : {}),
    });
  }
  private async accessToken(actor: AuthenticatedActor, connectionId: string) {
    const connection = await this.connection(actor, connectionId);
    if (connection.status !== 'connected' || !connection.encrypted_refresh_token)
      throw new BadRequestException('Gmail connection is not active.');
    const config = this.config();
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: this.decrypt(connection.encrypted_refresh_token),
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) throw new BadRequestException('Gmail session could not be refreshed.');
    const token = (await response.json()) as { access_token?: string };
    if (!token.access_token) throw new BadRequestException('Gmail did not return an access token.');
    return token.access_token;
  }
  private async connection(actor: AuthenticatedActor, connectionId: string) {
    const result = await this.pool.query<ConnectionRow>(
      'SELECT id, mailbox, scopes, status, connected_at, encrypted_refresh_token FROM integration_connections WHERE id = $1 AND organization_id = $2 AND provider = $3',
      [connectionId, actor.organizationId, 'gmail'],
    );
    return row(result.rows, 'Gmail connection is unavailable.');
  }
  private async gmailMessage(accessToken: string, messageId: string, format: 'metadata' | 'full') {
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}?format=${format}&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) throw new BadRequestException('Gmail message is unavailable.');
    return (await response.json()) as GmailMessage;
  }
  private toMessageSummary(message: GmailMessage) {
    const headers = this.headerMap(message.payload?.headers ?? []);
    return {
      id: message.id,
      threadId: message.threadId,
      from: headers.get('from') ?? 'Unknown sender',
      subject: headers.get('subject') ?? '(No subject)',
      date: headers.get('date') ?? null,
      snippet: message.snippet ?? '',
    };
  }
  private headerMap(headers: Array<{ name?: string; value?: string }>) {
    return new Map(
      headers.flatMap((header) =>
        header.name && header.value
          ? [[header.name.toLocaleLowerCase(), header.value] as const]
          : [],
      ),
    );
  }
  private messageBody(payload: GmailPayload | undefined): string {
    if (!payload) return '';
    if (payload.mimeType === 'text/plain' && payload.body?.data)
      return Buffer.from(payload.body.data, 'base64url').toString('utf8');
    return (payload.parts ?? []).map((part) => this.messageBody(part)).find(Boolean) ?? '';
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
interface GmailPayload {
  mimeType?: string;
  body?: { data?: string };
  headers?: Array<{ name?: string; value?: string }>;
  parts?: GmailPayload[];
}
interface GmailMessage {
  id: string;
  threadId?: string;
  snippet?: string;
  payload?: GmailPayload;
}
const row = <T extends QueryResultRow>(rows: T[], message: string) => {
  const value = rows[0];
  if (!value) throw new BadRequestException(message);
  return value;
};
