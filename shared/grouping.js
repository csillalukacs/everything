// Collapse a newest-first list of feed events or notifications into runs of
// consecutive entries that share the same actor and kind. A run of length 1 is a
// normal single row; a longer run renders as "x <verb> N things" with a photo
// stack instead of N separate rows. Used by both apps' feed + notifications.
//
// actorOf(entry)  -> a stable id for the person who caused the entry.
// kindOf(entry)   -> the action kind to group within (e.g. 'usage' vs 'add').
//   Return a falsy value to opt an entry out of grouping entirely — e.g. a
//   follow notification, which never reads as "followed you N times".
// bucketOf(entry) -> optional. When given, entries only merge if they share the
//   same bucket too — used to keep grouping within a single day.
//
// The result preserves input order; each group carries the matching `entries`
// and a `key` derived from the first entry for stable React keys.
export function groupConsecutive(list, actorOf, kindOf, bucketOf = null) {
  const groups = [];
  for (const entry of list) {
    const actor = actorOf(entry);
    const kind = kindOf(entry);
    const bucket = bucketOf ? bucketOf(entry) : null;
    const last = groups[groups.length - 1];
    if (kind && last && last.kind === kind && last.actor === actor && last.bucket === bucket) {
      last.entries.push(entry);
    } else {
      groups.push({ key: entry.key ?? entry.id, actor, kind, bucket, entries: [entry] });
    }
  }
  return groups;
}
