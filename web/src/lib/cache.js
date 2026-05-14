export function readCache(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null }
}

export function writeCache(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota or disabled — ignore */ }
}
