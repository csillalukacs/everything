// Deletes objects from R2. Each path must start with the caller's user_id prefix
// so a client can't delete another user's files.
//
// Body: { paths: string[] }
// Each path is the R2 key, e.g. "<user_id>/1715000000000.png".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  let body: { paths?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }

  const paths = Array.isArray(body.paths)
    ? body.paths.filter((p): p is string => typeof p === 'string' && p.length > 0)
    : [];
  if (paths.length === 0) return json({ deleted: 0, failed: 0 });

  const prefix = `${user.id}/`;
  const invalid = paths.filter(p => !p.startsWith(prefix));
  if (invalid.length > 0) return json({ error: 'forbidden paths', paths: invalid }, 403);

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const bucket = Deno.env.get('R2_BUCKET');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    return json({ error: 'r2 not configured' }, 500);
  }

  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`;

  const results = await Promise.allSettled(
    paths.map(path => aws.fetch(`${base}/${path}`, { method: 'DELETE' })),
  );

  let deleted = 0;
  let failed = 0;
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.ok) deleted++;
    else failed++;
  }
  if (failed > 0) console.warn(`r2-delete: ${failed}/${paths.length} failed for user ${user.id}`);
  return json({ deleted, failed });
});
