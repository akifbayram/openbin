import fs from 'node:fs';
import path from 'node:path';
import { PassThrough, type Readable } from 'node:stream';
import { config } from './config.js';
import { safePath } from './pathSafety.js';

export interface StorageBackend {
  upload(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  readStream(key: string): Readable;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  getUrl(key: string): string | null;
}

class LocalStorage implements StorageBackend {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  async upload(key: string, data: Buffer): Promise<void> {
    const filePath = safePath(this.basePath, key);
    if (!filePath) throw new Error('Invalid storage key');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, data);
  }

  async read(key: string): Promise<Buffer> {
    const filePath = safePath(this.basePath, key);
    if (!filePath) throw new Error('Invalid storage key');
    return fs.readFileSync(filePath);
  }

  readStream(key: string): Readable {
    const filePath = safePath(this.basePath, key);
    if (!filePath) throw new Error('Invalid storage key');
    return fs.createReadStream(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = safePath(this.basePath, key);
    if (!filePath) return;
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // Ignore deletion errors
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = safePath(this.basePath, key);
    if (!filePath) return false;
    return fs.existsSync(filePath);
  }

  getUrl(): string | null {
    return null;
  }
}

class S3Storage implements StorageBackend {
  private bucket: string;
  private ready: Promise<{ client: any; sdk: any }>;

  constructor(bucket: string) {
    this.bucket = bucket;
    this.ready = import('@aws-sdk/client-s3').then((sdk) => ({
      sdk,
      client: new sdk.S3Client({
        region: config.s3Region,
        ...(config.s3Endpoint && { endpoint: config.s3Endpoint }),
        forcePathStyle: config.s3ForcePathStyle,
        credentials: {
          accessKeyId: config.s3AccessKeyId!,
          secretAccessKey: config.s3SecretAccessKey!,
        },
      }),
    }));
  }

  async upload(key: string, data: Buffer, contentType: string): Promise<void> {
    const { client, sdk } = await this.ready;
    await client.send(
      new sdk.PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
      }),
    );
  }

  async read(key: string): Promise<Buffer> {
    const { client, sdk } = await this.ready;
    const response = await client.send(
      new sdk.GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    return Buffer.from(await response.Body!.transformToByteArray());
  }

  readStream(key: string): Readable {
    const pass = new PassThrough();
    this.ready
      .then(({ client, sdk }) =>
        client.send(
          new sdk.GetObjectCommand({ Bucket: this.bucket, Key: key }),
        ),
      )
      .then((response: any) => {
        (response.Body as Readable).pipe(pass);
      })
      .catch((err: Error) => pass.destroy(err));
    return pass;
  }

  async delete(key: string): Promise<void> {
    const { client, sdk } = await this.ready;
    await client.send(
      new sdk.DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async exists(key: string): Promise<boolean> {
    const { client, sdk } = await this.ready;
    try {
      await client.send(
        new sdk.HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch (err: unknown) {
      const name = (err as { name?: string }).name;
      if (name === 'NotFound' || name === 'NoSuchKey') return false;
      throw err;
    }
  }

  getUrl(): string | null {
    return null;
  }
}

function createStorage(): StorageBackend {
  if (config.storageBackend === 's3') {
    return new S3Storage(config.s3Bucket!);
  }
  return new LocalStorage(config.photoStoragePath);
}

export const storage = createStorage();
