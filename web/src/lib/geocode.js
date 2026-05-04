const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export async function searchPlaces(query) {
  const q = query.trim()
  if (!q) return []
  const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`
  try {
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return data.map(r => ({
      display_name: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
    }))
  } catch {
    return []
  }
}
