// Returns presigned PUT URLs for uploading a main image and its thumbnail to R2.
// The caller's Supabase JWT is verified; the user_id is read from the JWT, never
// from the request body, so a client can't write into another user's folder.
//
// Required env (set via `supabase secrets set ...`):
//   R2_ACCOUNT_ID
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_BUCKET
//   R2_PUBLIC_BASE       e.g. https://pub-<hash>.r2.dev or https://images.example.com
//
// SUPABASE_URL and SUPABASE_ANON_KEY are auto-injected by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ALLOWED_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif']);
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const auth = req.headers.get('Authorization');
  if (!auth) return json({ error: 'unauthorized' }, 401);

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user }, error: uErr } = await supabase.auth.getUser();
  if (uErr || !user) return json({ error: 'unauthorized' }, 401);

  let body: { ext?: string; contentType?: string };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  const ext = (body.ext || '').toLowerCase();
  const contentType = body.contentType || '';
  if (!ALLOWED_EXTS.has(ext) || !contentType.startsWith('image/')) {
    return json({ error: 'bad ext or contentType' }, 400);
  }

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const bucket = Deno.env.get('R2_BUCKET');
  const publicBase = (Deno.env.get('R2_PUBLIC_BASE') || '').replace(/\/+$/, '');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  if (!accountId || !bucket || !publicBase || !accessKeyId || !secretAccessKey) {
    return json({ error: 'r2 not configured' }, 500);
  }

  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const ts = Date.now();
  const mainPath = `${user.id}/${ts}.${ext}`;
  const thumbPath = `${user.id}/${ts}_thumb.webp`;

  async function presign(path: string, ct: string) {
    const url = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${path}?X-Amz-Expires=3600`;
    const signed = await aws.sign(new Request(url, {
      method: 'PUT',
      headers: { 'Content-Type': ct, 'Cache-Control': CACHE_CONTROL },
    }), { aws: { signQuery: true } });
    return signed.url;
  }

  try {
    const [mainUrl, thumbUrl] = await Promise.all([
      presign(mainPath, contentType),
      presign(thumbPath, 'image/webp'),
    ]);
    return json({
      cacheControl: CACHE_CONTROL,
      main: { uploadUrl: mainUrl, publicUrl: `${publicBase}/${mainPath}` },
      thumb: { uploadUrl: thumbUrl, publicUrl: `${publicBase}/${thumbPath}` },
    });
  } catch (e) {
    console.error('presign failed:', e);
    return json({ error: 'sign failed' }, 500);
  }
});
