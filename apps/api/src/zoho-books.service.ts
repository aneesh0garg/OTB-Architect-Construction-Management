import { BadRequestException, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { AuditService } from './audit.service.js';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';

interface ConnectionRow extends QueryResultRow {
  id: string;
  mailbox: string | null;
  scopes: string[];
  status: string;
  connected_at: Date | null;
  encrypted_refresh_token?: string | null;
}
interface OAuthStateRow extends QueryResultRow {
  id: string;
  organization_id: string;
  actor_id: string;
}
interface InvoiceRow extends QueryResultRow {
  id: string;
  invoice_number: number;
  client_name: string;
  issue_date: string | null;
  due_date: string | null;
}
interface InvoiceLineRow extends QueryResultRow {
  description: string;
  quantity: number;
  unit_amount: string;
}

const scopes = ['ZohoBooks.fullaccess.all'];

@Injectable()
export class ZohoBooksService {
  constructor(
    private readonly database: DatabaseService,
    private readonly projectAccess: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async list(actor: AuthenticatedActor) {
    const result = await this.database.query<ConnectionRow>(
      "SELECT id, mailbox, scopes, status, connected_at FROM integration_connections WHERE organization_id = $1 AND provider = 'zoho_books' ORDER BY created_at DESC",
      [actor.organizationId],
    );
    return result.rows;
  }

  async start(actor: AuthenticatedActor) {
    this.requireAdmin(actor);
    const config = this.config();
    await this.ensureOrganization(actor);
    const state = randomUUID();
    await this.database.query(
      "INSERT INTO integration_oauth_states (id, organization_id, actor_id, provider, expires_at) VALUES ($1,$2,$3,'zoho_books',NOW() + INTERVAL '10 minutes')",
      [state, actor.organizationId, actor.userId],
    );
    const parameters = new URLSearchParams({
      response_type: 'code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes.join(','),
      state,
    });
    return {
      authorizationUrl: `${config.accountsBase}/oauth/v2/auth?${parameters.toString()}`,
      stateExpiresInMinutes: 10,
      scopes,
    };
  }

  async complete(code: string, state: string) {
    const config = this.config();
    const stateResult = await this.database.query<OAuthStateRow>(
      "DELETE FROM integration_oauth_states WHERE id = $1 AND provider = 'zoho_books' AND expires_at > NOW() RETURNING id, organization_id, actor_id",
      [state],
    );
    const oauth = row(stateResult.rows, 'OAuth state is invalid or expired.');
    const response = await fetch(`${config.accountsBase}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: config.redirectUri,
        code,
      }),
    });
    if (!response.ok) throw new BadRequestException('Zoho Books authorization exchange failed.');
    const token = (await response.json()) as { refresh_token?: string };
    if (!token.refresh_token)
      throw new BadRequestException('Zoho did not return a refresh token; reconnect with consent.');
    const connection = await this.database.query<ConnectionRow>(
      `INSERT INTO integration_connections (organization_id, provider, mailbox, scopes, encrypted_refresh_token, status, connected_by, connected_at)
       VALUES ($1,'zoho_books',$2,$3,$4,'connected',$5,NOW())
       ON CONFLICT (organization_id, provider, mailbox) DO UPDATE SET scopes = EXCLUDED.scopes, encrypted_refresh_token = EXCLUDED.encrypted_refresh_token, status = 'connected', connected_by = EXCLUDED.connected_by, connected_at = NOW()
       RETURNING id, mailbox, scopes, status, connected_at`,
      [
        oauth.organization_id,
        config.zohoOrganizationId,
        scopes,
        this.encrypt(token.refresh_token),
        oauth.actor_id,
      ],
    );
    return row(connection.rows, 'Zoho Books connection could not be saved.');
  }

  async disconnect(actor: AuthenticatedActor, connectionId: string) {
    this.requireAdmin(actor);
    const result = await this.database.query<ConnectionRow>(
      "UPDATE integration_connections SET status = 'disconnected', encrypted_refresh_token = NULL WHERE id = $1 AND organization_id = $2 AND provider = 'zoho_books' RETURNING id, mailbox, scopes, status, connected_at",
      [connectionId, actor.organizationId],
    );
    return row(result.rows, 'Zoho Books connection is unavailable.');
  }

  async syncInvoice(
    actor: AuthenticatedActor,
    projectId: string,
    invoiceId: string,
    customerId: string,
  ) {
    await this.projectAccess.requireAccess(actor, projectId);
    if (
      !actor.roles.some((role) =>
        ['organization_admin', 'principal', 'finance_admin'].includes(role),
      )
    )
      throw new BadRequestException('Finance permission is required.');
    const invoiceResult = await this.database.query<InvoiceRow>(
      'SELECT id, invoice_number, client_name, issue_date, due_date FROM invoices WHERE id = $1 AND project_id = $2 AND organization_id = $3',
      [invoiceId, projectId, actor.organizationId],
    );
    const invoice = row(invoiceResult.rows, 'Invoice is unavailable.');
    const lines = await this.database.query<InvoiceLineRow>(
      'SELECT description, quantity, unit_amount FROM invoice_lines WHERE invoice_id = $1 ORDER BY id',
      [invoice.id],
    );
    const config = this.config();
    try {
      const token = await this.accessToken(actor, config);
      const response = await fetch(
        `${config.apiBase}/books/v3/invoices?organization_id=${encodeURIComponent(config.zohoOrganizationId)}`,
        {
          method: 'POST',
          headers: {
            authorization: `Zoho-oauthtoken ${token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            customer_id: customerId,
            date: invoice.issue_date ?? undefined,
            due_date: invoice.due_date ?? undefined,
            reference_number: `ORB-${invoice.invoice_number}`,
            line_items: lines.rows.map((line) => ({
              name: line.description,
              quantity: line.quantity,
              rate: Number(line.unit_amount),
            })),
          }),
        },
      );
      const result = (await response.json()) as {
        invoice?: { invoice_id?: string };
        message?: string;
      };
      if (!response.ok || !result.invoice?.invoice_id)
        throw new Error(result.message ?? 'Zoho Books rejected the invoice.');
      await this.database.query(
        "UPDATE invoices SET accounting_sync_status = 'synced', accounting_external_id = $1, accounting_sync_error = NULL WHERE id = $2",
        [result.invoice.invoice_id, invoice.id],
      );
      await this.audit.record(actor, 'accounting.invoice_synced', 'invoice', invoice.id, {
        projectId,
        provider: 'zoho_books',
        externalInvoiceId: result.invoice.invoice_id,
      });
      return {
        invoiceId: invoice.id,
        externalInvoiceId: result.invoice.invoice_id,
        status: 'synced',
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message.slice(0, 1000) : 'Zoho Books sync failed.';
      await this.database.query(
        "UPDATE invoices SET accounting_sync_status = 'failed', accounting_sync_error = $1 WHERE id = $2",
        [message, invoice.id],
      );
      await this.audit.record(actor, 'accounting.invoice_sync_failed', 'invoice', invoice.id, {
        projectId,
        provider: 'zoho_books',
      });
      throw new BadRequestException(message);
    }
  }

  private async accessToken(actor: AuthenticatedActor, config: ZohoConfig) {
    const connectionResult = await this.database.query<ConnectionRow>(
      "SELECT id, mailbox, scopes, status, connected_at, encrypted_refresh_token FROM integration_connections WHERE organization_id = $1 AND provider = 'zoho_books' AND status = 'connected' ORDER BY connected_at DESC LIMIT 1",
      [actor.organizationId],
    );
    const connection = row(
      connectionResult.rows,
      'Connect Zoho Books before synchronizing invoices.',
    );
    if (!connection.encrypted_refresh_token)
      throw new BadRequestException('Zoho Books connection is not active.');
    const response = await fetch(`${config.accountsBase}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: this.decrypt(connection.encrypted_refresh_token),
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!response.ok) throw new BadRequestException('Zoho Books session could not be refreshed.');
    const token = (await response.json()) as { access_token?: string };
    if (!token.access_token) throw new BadRequestException('Zoho did not return an access token.');
    return token.access_token;
  }

  private config(): ZohoConfig {
    const clientId = process.env.ZOHO_CLIENT_ID;
    const clientSecret = process.env.ZOHO_CLIENT_SECRET;
    const redirectUri = process.env.ZOHO_REDIRECT_URI;
    const zohoOrganizationId = process.env.ZOHO_ORGANIZATION_ID;
    if (!clientId || !clientSecret || !redirectUri || !zohoOrganizationId)
      throw new BadRequestException(
        'Zoho Books is not configured. Set ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, ZOHO_REDIRECT_URI, and ZOHO_ORGANIZATION_ID.',
      );
    if (!process.env.INTEGRATION_TOKEN_KEY)
      throw new BadRequestException(
        'INTEGRATION_TOKEN_KEY is required before accounting credentials can be stored.',
      );
    return {
      clientId,
      clientSecret,
      redirectUri,
      zohoOrganizationId,
      accountsBase: process.env.ZOHO_ACCOUNTS_BASE ?? 'https://accounts.zoho.in',
      apiBase: process.env.ZOHO_API_BASE ?? 'https://www.zohoapis.in',
    };
  }
  private encrypt(value: string) {
    const key = createHash('sha256').update(process.env.INTEGRATION_TOKEN_KEY!).digest();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }
  private decrypt(payload: string) {
    const [iv, tag, encrypted] = payload.split('.');
    if (!iv || !tag || !encrypted)
      throw new BadRequestException('Stored Zoho credential is invalid.');
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
    await this.database.query(
      'INSERT INTO organizations (id, name) VALUES ($1,$1) ON CONFLICT (id) DO NOTHING',
      [actor.organizationId],
    );
  }
}
interface ZohoConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  zohoOrganizationId: string;
  accountsBase: string;
  apiBase: string;
}
const row = <T extends QueryResultRow>(rows: T[], message: string) => {
  const value = rows[0];
  if (!value) throw new BadRequestException(message);
  return value;
};
