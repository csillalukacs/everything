#!/usr/bin/env node
// Copy every object from the Supabase Storage bucket to R2 at the same key.
// Resumable: skips objects already present in R2 with the same size.
//
// One-time install:
//   npm i --no-save @aws-sdk/client-s3
//
// Required env:
//   SUPABASE_S3_ENDPOINT       e.g. https://<ref>.storage.supabase.co/storage/v1/s3
//   SUPABASE_S3_REGION         e.g. us-east-1 (whatever your project shows)
//   SUPABASE_S3_ACCESS_KEY_ID
//   SUPABASE_S3_SECRET_ACCESS_KEY
//   SUPABASE_BUCKET            e.g. item-images
//   R2_ENDPOINT                https://<account-id>.r2.cloudflarestorage.com
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET                  e.g. things-images
//
// Optional:
//   DRY_RUN=1                  list what would be copied without writing
//   CONCURRENCY=8              parallel transfers (default 8)
//   PREFIX=<userId>/           limit to one user's folder
//   OVERWRITE=1                copy even if object exists in R2

const {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const required = [
  'SUPABASE_S3_ENDPOINT', 'SUPABASE_S3_REGION',
  'SUPABASE_S3_ACCESS_KEY_ID', 'SUPABASE_S3_SECRET_ACCESS_KEY', 'SUPABASE_BUCKET',
  'R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET',
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}

const DRY_RUN = process.env.DRY_RUN === '1';
const OVERWRITE = process.env.OVERWRITE === '1';
const CONCURRENCY = parseInt(process.env.CONCURRENCY, 10) || 8;
const PREFIX = process.env.PREFIX || undefined;
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET;
const R2_BUCKET = process.env.R2_BUCKET;

const supabase = new S3Client({
  endpoint: process.env.SUPABASE_S3_ENDPOINT,
  region: process.env.SUPABASE_S3_REGION,
  credentials: {
    accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const r2 = new S3Client({
  endpoint: process.env.R2_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function retry(fn, attempts = 4, baseMs = 500) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1) break;
      const delay = baseMs * (2 ** i) + Math.random() * 250;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

async function r2Has(key, sourceSize) {
  try {
    const head = await r2.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    return head.ContentLength === sourceSize;
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.name === 'NotFound') return false;
    throw e;
  }
}

async function copyOne(obj) {
  const key = obj.Key;
  if (!OVERWRITE && await retry(() => r2Has(key, obj.Size))) return { key, status: 'skip' };

  const { body, contentType, cacheControl } = await retry(async () => {
    const get = await supabase.send(new GetObjectCommand({ Bucket: SUPABASE_BUCKET, Key: key }));
    return {
      body: await streamToBuffer(get.Body),
      contentType: get.ContentType,
      cacheControl: get.CacheControl,
    };
  });

  if (DRY_RUN) return { key, status: 'dry', bytes: body.length };

  await retry(() => r2.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: cacheControl,
  })));
  return { key, status: 'ok', bytes: body.length };
}

async function* listSource() {
  let token;
  for (;;) {
    const res = await supabase.send(new ListObjectsV2Command({
      Bucket: SUPABASE_BUCKET,
      Prefix: PREFIX,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const obj of res.Contents ?? []) yield obj;
    if (!res.IsTruncated) break;
    token = res.NextContinuationToken;
  }
}

async function runPool(iterable, worker, concurrency) {
  const it = iterable[Symbol.asyncIterator]();
  let active = 0;
  let done = false;
  const stats = { ok: 0, skip: 0, fail: 0, bytes: 0, total: 0 };

  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = e => { if (!settled) { settled = true; reject(e); } };

    const tick = () => {
      if (done && active === 0) { settled = true; resolve(stats); return; }
      while (active < concurrency && !done) {
        active++;
        it.next().then(({ value, done: d }) => {
          if (d) {
            done = true;
            active--;
            tick();
            return;
          }
          stats.total++;
          worker(value).then(r => {
            if (r.status === 'ok' || r.status === 'dry') { stats.ok++; stats.bytes += r.bytes || 0; }
            else if (r.status === 'skip') stats.skip++;
            if (stats.total % 25 === 0) {
              const mb = (stats.bytes / 1024 / 1024).toFixed(1);
              console.log(`  progress: ${stats.total} seen | ${stats.ok} copied | ${stats.skip} skipped | ${stats.fail} failed | ${mb} MB`);
            }
          }).catch(e => {
            stats.fail++;
            console.error(`[fail] ${value.Key}: ${e.message}`);
          }).finally(() => {
            active--;
            tick();
          });
        }).catch(fail);
      }
    };
    tick();
  });
}

async function main() {
  console.log(`Migrating ${SUPABASE_BUCKET} → ${R2_BUCKET}${PREFIX ? ` (prefix: ${PREFIX})` : ''}${DRY_RUN ? ' (dry run)' : ''}, concurrency=${CONCURRENCY}`);
  const start = Date.now();
  const stats = await runPool(listSource(), copyOne, CONCURRENCY);
  const secs = ((Date.now() - start) / 1000).toFixed(1);
  const mb = (stats.bytes / 1024 / 1024).toFixed(1);
  console.log(`\ndone in ${secs}s: ${stats.ok} copied, ${stats.skip} already present, ${stats.fail} failed, ${mb} MB transferred`);
  if (stats.fail > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
