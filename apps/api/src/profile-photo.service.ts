import { BadRequestException, Injectable } from '@nestjs/common';
import { CreateBucketCommand, GetObjectCommand, HeadBucketCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { AuditService } from './audit.service.js';
import { DatabaseService } from './database.service.js';

type UploadRow = QueryResultRow & { id: string; storage_key: string; content_type: string; expected_size: string; status: string };
const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class ProfilePhotoService {
  private readonly client = new S3Client({ endpoint: process.env.S3_ENDPOINT ?? 'http://localhost:9000', region: process.env.S3_REGION ?? 'ap-south-1', forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? 'orbita', secretAccessKey: process.env.S3_SECRET_KEY ?? 'orbita_local_storage' } });
  private readonly browserClient = new S3Client({ endpoint: process.env.S3_PUBLIC_ENDPOINT ?? process.env.S3_ENDPOINT ?? 'http://localhost:9000', region: process.env.S3_REGION ?? 'ap-south-1', forcePathStyle: true, credentials: { accessKeyId: process.env.S3_ACCESS_KEY ?? 'orbita', secretAccessKey: process.env.S3_SECRET_KEY ?? 'orbita_local_storage' } });
  private bucketReady: Promise<void> | undefined;
  constructor(private readonly database: DatabaseService, private readonly audit: AuditService) {}

  async prepare(actor: AuthenticatedActor, userId: string, input: { fileName: string; contentType: string; size: number }) {
    await this.authorize(actor, userId);
    if (!allowed.has(input.contentType) || !Number.isInteger(input.size) || input.size < 1 || input.size > 5 * 1024 * 1024) throw new BadRequestException('Profile photos must be JPEG, PNG, or WebP and no larger than 5 MB.');
    await this.ensureBucket();
    const extension = input.contentType === 'image/jpeg' ? 'jpg' : input.contentType.split('/')[1];
    const storageKey = `organizations/${actor.organizationId}/people/${userId}/profile-${randomUUID()}.${extension}`;
    const saved = await this.database.query<UploadRow>("INSERT INTO member_profile_photo_uploads (organization_id, user_id, storage_key, content_type, expected_size, expires_at) VALUES ($1,$2,$3,$4,$5,NOW() + INTERVAL '15 minutes') RETURNING id, storage_key, content_type, expected_size, status", [actor.organizationId, userId, storageKey, input.contentType, input.size]);
    const upload = saved.rows[0];
    if (!upload) throw new BadRequestException('Profile-photo upload could not be prepared.');
    return { uploadId: upload.id, uploadUrl: await getSignedUrl(this.browserClient, new PutObjectCommand({ Bucket: this.bucket(), Key: storageKey, ContentType: input.contentType }), { expiresIn: 900 }) };
  }
  async complete(actor: AuthenticatedActor, userId: string, uploadId: string) {
    await this.authorize(actor, userId);
    const result = await this.database.query<UploadRow>("SELECT id, storage_key, content_type, expected_size, status FROM member_profile_photo_uploads WHERE id = $1 AND organization_id = $2 AND user_id = $3 AND status = 'pending'", [uploadId, actor.organizationId, userId]);
    const upload = result.rows[0]; if (!upload) throw new BadRequestException('Profile-photo upload is unavailable.');
    const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket(), Key: upload.storage_key }));
    if (head.ContentType !== upload.content_type || head.ContentLength !== Number(upload.expected_size)) throw new BadRequestException('Profile-photo upload could not be verified.');
    await this.database.query("UPDATE member_profile_photo_uploads SET status = 'complete' WHERE id = $1", [upload.id]);
    await this.database.query('UPDATE people SET profile_photo_key = $1 WHERE organization_id = $2 AND user_id = $3', [upload.storage_key, actor.organizationId, userId]);
    await this.audit.record(actor, 'organization.member_profile_photo_updated', 'person', userId, {});
    return this.url(actor, userId);
  }
  async url(actor: AuthenticatedActor, userId: string) {
    const result = await this.database.query<QueryResultRow & { profile_photo_key: string | null }>('SELECT profile_photo_key FROM people WHERE organization_id = $1 AND user_id = $2', [actor.organizationId, userId]);
    const key = result.rows[0]?.profile_photo_key; if (!key) return { profilePhotoUrl: null };
    return { profilePhotoUrl: await getSignedUrl(this.browserClient, new GetObjectCommand({ Bucket: this.bucket(), Key: key }), { expiresIn: 300 }) };
  }
  private async authorize(actor: AuthenticatedActor, userId: string) { if (actor.userId !== userId && !actor.roles.some((role) => ['organization_admin', 'principal', 'project_manager'].includes(role))) throw new BadRequestException('You may only change your own profile photo.'); }
  private async ensureBucket() { this.bucketReady ??= (async () => { try { await this.client.send(new HeadBucketCommand({ Bucket: this.bucket() })); } catch { await this.client.send(new CreateBucketCommand({ Bucket: this.bucket() })); } })(); await this.bucketReady; }
  private bucket() { return process.env.S3_BUCKET ?? 'orbita'; }
}
