// Shared placeholder logic for profile pictures: when a profile has no
// avatar_url, both apps render a single uppercase initial on a colored
// background. Colors are deterministic per profile (hashed from the
// identifier) so a user keeps the same placeholder color everywhere.

const PALETTE = [
  '#B7C4A4', // sage
  '#C9A78F', // taupe
  '#A8B5C4', // dusty blue
  '#C7A8A0', // muted clay
  '#B5A8C4', // lavender grey
  '#A4B8B0', // eucalyptus
  '#C4B59B', // sand
  '#9FB0A8', // grey-green
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
