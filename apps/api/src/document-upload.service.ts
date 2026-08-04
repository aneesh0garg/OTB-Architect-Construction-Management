import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'node:crypto';
import type { AuthenticatedActor } from '@orbita/contracts';
import type { QueryResultRow } from 'pg';
import { AuditService } from './audit.service.js';
import { DatabaseService } from './database.service.js';
import { ProjectAccessService } from './project-access.service.js';

interface UploadRow extends QueryResultRow {
  id: string;
  storage_key: string;
  original_name: string;
  content_type: string;
  expected_size: string;
  actual_size: string | null;
  status: string;
  content_sha256: string | null;
}
interface DocumentStorageRow extends QueryResultRow {
  id: string;
  storage_key: string | null;
}

const createStorageClient = (endpoint: string) =>
  new S3Client({
    endpoint,
    region: process.env.S3_REGION ?? 'ap-south-1',
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY ?? 'orbita',
      secretAccessKey: process.env.S3_SECRET_KEY ?? 'orbita_local_storage',
    },
  });

@Injectable()
export class DocumentUploadService {
  private readonly endpoint = process.env.S3_ENDPOINT ?? 'http://localhost:9000';
  private readonly client = createStorageClient(this.endpoint);
  // The API can retain a loopback storage connection, while browsers on a LAN
  // device need a URL that resolves to the development machine.
  private readonly browserClient = createStorageClient(
    process.env.S3_PUBLIC_ENDPOINT ?? this.lanStorageEndpoint() ?? this.endpoint,
  );
  private bucketReady: Promise<void> | undefined;

  constructor(
    private readonly database: DatabaseService,
    private readonly projectAccess: ProjectAccessService,
    private readonly audit: AuditService,
  ) {}

  async create(actor: AuthenticatedActor, projectId: string, input: CreateUploadInput) {
    await this.projectAccess.requireAccess(actor, projectId);
    this.validate(input);
    return this.prepare(actor, projectId, input);
  }

  async createBatch(actor: AuthenticatedActor, projectId: string, inputs: CreateUploadInput[]) {
    await this.projectAccess.requireAccess(actor, projectId);
    inputs.forEach((input) => this.validate(input));
    const uploads = await Promise.all(inputs.map((input) => this.prepare(actor, projectId, input)));
    await this.audit.record(
      actor,
      'document.upload_batch_prepared',
      'document_upload_batch',
      projectId,
      {
        projectId,
        count: uploads.length,
      },
    );
    return { uploads, expiresInSeconds: 900 };
  }

  private async prepare(actor: AuthenticatedActor, projectId: string, input: CreateUploadInput) {
    const contentType = input.contentType?.trim().toLocaleLowerCase();
    const originalName = safeName(input.fileName);
    const key = `organizations/${actor.organizationId}/projects/${projectId}/uploads/${randomUUID()}/${originalName}`;
    await this.ensureBucket();
    const result = await this.database.query<UploadRow>(
      "INSERT INTO document_uploads (organization_id, project_id, storage_key, original_name, content_type, expected_size, expires_at, uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,NOW() + INTERVAL '15 minutes',$7) RETURNING id, storage_key, original_name, content_type, expected_size, actual_size, status, content_sha256",
      [actor.organizationId, projectId, key, originalName, contentType, input.size, actor.userId],
    );
    const upload = row(result.rows, 'Upload could not be prepared.');
    const uploadUrl = await getSignedUrl(
      this.browserClient,
      new PutObjectCommand({ Bucket: this.bucket(), Key: key, ContentType: contentType }),
      { expiresIn: 900 },
    );
    await this.audit.record(actor, 'document.upload_prepared', 'document_upload', upload.id, {
      projectId,
      originalName,
      expectedSize: input.size,
    });
    return {
      uploadId: upload.id,
      storageKey: upload.storage_key,
      uploadUrl,
      expiresInSeconds: 900,
    };
  }

  async complete(actor: AuthenticatedActor, projectId: string, uploadId: string) {
    await this.projectAccess.requireAccess(actor, projectId);
    const upload = await this.find(actor, projectId, uploadId, 'pending');
    const head = await this.client.send(
      new HeadObjectCommand({ Bucket: this.bucket(), Key: upload.storage_key }),
    );
    const actualSize = head.ContentLength;
    if (!actualSize || actualSize !== Number(upload.expected_size))
      throw new BadRequestException('Uploaded file size does not match the prepared upload.');
    if (head.ContentType !== upload.content_type)
      throw new BadRequestException('Uploaded file type does not match the prepared upload.');
    const object = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket(), Key: upload.storage_key }),
    );
    const bytes = await object.Body?.transformToByteArray();
    if (!bytes || bytes.byteLength !== actualSize)
      throw new BadRequestException('Uploaded file could not be read for integrity verification.');
    const checksum = createHash('sha256').update(bytes).digest('hex');
    const result = await this.database.query<UploadRow>(
      "UPDATE document_uploads SET status = 'uploaded', actual_size = $1, content_sha256 = $2, completed_at = NOW() WHERE id = $3 AND status = 'pending' RETURNING id, storage_key, original_name, content_type, expected_size, actual_size, status, content_sha256",
      [actualSize, checksum, upload.id],
    );
    const completed = row(result.rows, 'Upload is unavailable or already completed.');
    await this.audit.record(actor, 'document.upload_completed', 'document_upload', completed.id, {
      projectId,
      actualSize,
      checksum,
    });
    return {
      uploadId: completed.id,
      storageKey: completed.storage_key,
      checksumSha256: completed.content_sha256,
      status: completed.status,
    };
  }

  async consume(actor: AuthenticatedActor, projectId: string, uploadId: string) {
    const upload = await this.find(actor, projectId, uploadId, 'uploaded');
    const result = await this.database.query<UploadRow>(
      "UPDATE document_uploads SET status = 'attached', attached_at = NOW() WHERE id = $1 AND status = 'uploaded' RETURNING id, storage_key, original_name, content_type, expected_size, actual_size, status, content_sha256",
      [upload.id],
    );
    const attached = row(result.rows, 'Upload is unavailable or already attached.');
    await this.audit.record(actor, 'document.upload_attached', 'document_upload', attached.id, {
      projectId,
    });
    return { storageKey: attached.storage_key, checksumSha256: attached.content_sha256 };
  }

  async download(actor: AuthenticatedActor, projectId: string, documentId: string) {
    await this.projectAccess.requireAccess(actor, projectId);
    const result = await this.database.query<DocumentStorageRow>(
      'SELECT id, storage_key FROM document_revisions WHERE id = $1 AND organization_id = $2 AND project_id = $3',
      [documentId, actor.organizationId, projectId],
    );
    const document = row(result.rows, 'Document revision is unavailable.');
    if (!document.storage_key)
      throw new BadRequestException('This document revision has no uploaded original.');
    const downloadUrl = await getSignedUrl(
      this.browserClient,
      new GetObjectCommand({ Bucket: this.bucket(), Key: document.storage_key }),
      { expiresIn: 300 },
    );
    await this.audit.record(actor, 'document.download_prepared', 'document_revision', document.id, {
      projectId,
    });
    return {
      documentId: document.id,
      downloadUrl,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  }

  private async find(
    actor: AuthenticatedActor,
    projectId: string,
    uploadId: string,
    status: string,
  ) {
    const result = await this.database.query<UploadRow>(
      'SELECT id, storage_key, original_name, content_type, expected_size, actual_size, status, content_sha256 FROM document_uploads WHERE id = $1 AND organization_id = $2 AND project_id = $3 AND status = $4',
      [uploadId, actor.organizationId, projectId, status],
    );
    return row(result.rows, 'Upload is unavailable.');
  }
  private validate(input: CreateUploadInput) {
    if (!Number.isInteger(input.size) || input.size < 1 || input.size > 200 * 1024 * 1024)
      throw new BadRequestException('Upload size must be between 1 byte and 200 MB.');
    const contentType = input.contentType?.trim().toLocaleLowerCase();
    if (!contentType || !['application/pdf', 'image/jpeg', 'image/png'].includes(contentType))
      throw new BadRequestException('Only PDF, JPEG, and PNG uploads are allowed in Phase 1.');
    safeName(input.fileName);
  }
  private async ensureBucket() {
    this.bucketReady ??= (async () => {
      try {
        await this.client.send(new HeadBucketCommand({ Bucket: this.bucket() }));
      } catch {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket() }));
      }
    })();
    await this.bucketReady;
  }
  private bucket() {
    return process.env.S3_BUCKET ?? 'orbita';
  }
  private lanStorageEndpoint() {
    const host = process.env.ORBITA_LAN_HOST?.trim();
    return host ? `http://${host}:9000` : undefined;
  }
}

export interface CreateUploadInput {
  fileName: string;
  contentType: string;
  size: number;
}
const row = <T extends QueryResultRow>(rows: T[], message: string) => {
  const value = rows[0];
  if (!value) throw new BadRequestException(message);
  return value;
};
const safeName = (fileName: string) => {
  const name = fileName?.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!name || name.length > 160)
    throw new BadRequestException('Use a file name up to 160 characters.');
  return name;
};
