// Shared placeholder logic for profile pictures: when a profile has no
// avatar_url, both apps render a single uppercase initial on a colored
// background. Colors are deterministic per profile (hashed from the
// identifier) so a user keeps the same placeholder color everywhere.

// Bold, white-text-safe categorical hues (initials render in #fff). No yellow
// here — it fails contrast against white text.
const PALETTE = [
  '#E53935', // red
  '#1E88E5', // blue
  '#43A047', // green
  '#8E24AA', // purple
  '#00897B', // teal
  '#D81B60', // pink
  '#3949AB', // indigo
  '#455A64', // slate
];

export function avatarInitial(profile) {
  const source = profile?.display_name || profile?.username || '';
  const ch = source.trim().charAt(0);
  return ch ? ch.toUpperCase() : '?';
}

export function avatarColor(profile) {
  const key = profile?.username || profile?.user_id || profile?.display_name || '';
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function avatarSrc(profile) {
  return profile?.avatar_thumb_url || profile?.avatar_url || null;
}
