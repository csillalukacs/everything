// Pure-JS data access for item usages. Pass a Supabase client; both apps' clients work.
// A usage is one row per item per local day (used_on). on_feed marks whether the usage
// produced a public feed event. The items.usage_count / items.last_used_on rollups are
// maintained by a DB trigger (see sql/add_item_usages.sql), so callers don't touch them.

// Insert a usage for a given local day. Relies on the unique (item_id, used_on) index:
// a duplicate day is swallowed (ignoreDuplicates) and returns null rather than erroring.
export async function recordUsage(client, { itemId, userId, usedOn, onFeed = false }) {
  const { data, error } = await client
    .from('item_usages')
    .upsert(
      { item_id: itemId, user_id: userId, used_on: usedOn, on_feed: onFeed },
      { onConflict: 'item_id,used_on', ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function removeUsage(client, { itemId, usedOn }) {
  const { error } = await client
    .from('item_usages')
    .delete()
    .eq('item_id', itemId)
    .eq('used_on', usedOn);
  if (error) throw error;
}

// All used_on days for an item, most recent first. Used to light up the backfill grid.
export async function fetchItemUsages(client, itemId) {
  const { data, error } = await client
    .from('item_usages')
    .select('used_on, on_feed')
    .eq('item_id', itemId)
    .order('used_on', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
