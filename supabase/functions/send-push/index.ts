// Relays a freshly-inserted in-app notification to the OS via Expo Push.
//
// Called server-to-server by the notifications_send_push trigger (see
// sql/add_device_tokens.sql), NOT by an end-user client. The trigger authenticates
// with the service-role key as a Bearer token; we check it matches before doing any
// work. Body: { notification_id: string }.
//
// Flow: load the notification -> the recipient's device tokens -> the actor's name
// (+ item name for likes) -> POST a message per token to the Expo Push API. Expo
// relays to APNs using the APNs key configured in this project's Expo credentials,
// so there is no raw APNs handling here.
//
// Required env (auto-injected by the platform): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// User-facing copy. Keep in sync with S.notifications in shared/strings.js.
const COPY = {
  follow: 'followed you',
  like: 'favorited your thing',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function actorName(profile: { display_name?: string; username?: string } | null): string {
  return profile?.display_name || profile?.username || 'Someone';
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Only the trigger (bearing the service-role key) may invoke this.
  const auth = req.headers.get('Authorization');
  if (auth !== `Bearer ${serviceKey}`) return json({ error: 'unauthorized' }, 401);

  let body: { notification_id?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const notificationId = typeof body.notification_id === 'string' ? body.notification_id : null;
  if (!notificationId) return json({ error: 'missing notification_id' }, 400);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey);

  const { data: notif, error: nErr } = await supabase
    .from('notifications')
    .select('recipient_id, actor_id, type, item_id')
    .eq('id', notificationId)
    .single();
  if (nErr || !notif) return json({ error: 'notification not found' }, 404);

  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token')
    .eq('user_id', notif.recipient_id);
  if (!tokens || tokens.length === 0) return json({ sent: 0 });

  const { data: actor } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('user_id', notif.actor_id)
    .single();

  let itemName = '';
  if (notif.type === 'like' && notif.item_id) {
    const { data: item } = await supabase
      .from('items')
      .select('name')
      .eq('id', notif.item_id)
      .single();
    itemName = item?.name ?? '';
  }

  const bodyText = notif.type === 'like' && itemName
    ? `favorited "${itemName}"`
    : COPY[notif.type as 'follow' | 'like'] ?? '';

  const messages = tokens.map(({ token }) => ({
    to: token,
    title: actorName(actor),
    body: bodyText,
    sound: 'default',
    data: { type: notif.type, item_id: notif.item_id ?? null, actor_id: notif.actor_id },
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error('expo push error', res.status, text);
    return json({ error: 'expo push failed', status: res.status }, 502);
  }

  return json({ sent: messages.length });
});
