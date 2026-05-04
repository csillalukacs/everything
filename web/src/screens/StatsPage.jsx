import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const itemsCacheKey = userId => `cache:items:${userId}`

function readCache(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null } catch { return null }
}

function startOfDay(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x
}

function dayKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

function startOfWeek(d) {
  const x = startOfDay(d)
  const diff = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - diff)
  return x
}

function weekKey(d) { return dayKey(startOfWeek(d)) }

function monthKey(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function lastNDays(n) {
  const today = startOfDay(new Date())
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    out.push(d)
  }
  return out
}

function lastNWeeks(n) {
  const start = startOfWeek(new Date())
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(start); d.setDate(d.getDate() - i * 7)
    out.push(d)
  }
  return out
}

function lastNMonths(n) {
  const today = new Date()
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    out.push(new Date(today.getFullYear(), today.getMonth() - i, 1))
  }
  return out
}

function computeStreak(byDay) {
  if (byDay.size === 0) return 0
  const cursor = startOfDay(new Date())
  if (!byDay.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (byDay.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function computeLongestStreak(byDay) {
  const keys = [...byDay.keys()].sort()
  if (keys.length === 0) return 0
  let longest = 1, current = 1
  for (let i = 1; i < keys.length; i++) {
    const prev = new Date(keys[i - 1])
    const curr = new Date(keys[i])
    const diffDays = Math.round((curr - prev) / 86400000)
    if (diffDays === 1) { current++; longest = Math.max(longest, current) }
    else current = 1
  }
  return longest
}

function bucketize(items, keyFn) {
  const m = new Map()
  for (const item of items) {
    const k = keyFn(new Date(item.created_at))
    m.set(k, (m.get(k) ?? 0) + 1)
  }
  return m
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDayLabel(d, i, total) {
  if (total <= 14) return String(d.getDate())
  if (i === total - 1) return String(d.getDate())
  if (d.getDate() === 1) return MONTH_NAMES[d.getMonth()].toLowerCase()
  if (d.getDay() === 1) return String(d.getDate())
  return ''
}

function formatWeekLabel(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatMonthLabel(d) {
  return MONTH_NAMES[d.getMonth()].toLowerCase()
}

function Bar({ count, max, label, title, onClick }) {
  const heightPct = max > 0 ? (count / max) * 100 : 0
  const interactive = !!onClick && count > 0
  const Tag = interactive ? 'button' : 'div'
  return (
    <Tag
      className={`stats-bar-col${interactive ? ' stats-bar-col-clickable' : ''}`}
      title={title}
      onClick={interactive ? onClick : undefined}
      type={interactive ? 'button' : undefined}
    >
      <div className="stats-bar-track">
        {count > 0 && (
          <div className="stats-bar-fill" style={{ height: `${Math.max(heightPct, 2)}%` }}>
            <span className="stats-bar-value">{count}</span>
          </div>
        )}
      </div>
      <span className="stats-bar-label">{label}</span>
    </Tag>
  )
}

function dayKeyToDate(k) {
  return new Date(k)
}

function endOfWeekKey(k) {
  const d = dayKeyToDate(k)
  d.setDate(d.getDate() + 6)
  return dayKey(d)
}

function endOfMonthKey(k) {
  const [y, m] = k.split('-').map(Number)
  const d = new Date(y, m, 0)
  return dayKey(d)
}

function cityOf(loc) {
  if (!loc) return null
  const c = loc.split(',')[0].trim()
  return c || null
}

export default function StatsPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/'); return }
      setSession(session)
      const cached = readCache(itemsCacheKey(session.user.id))
      if (cached) { setItems(cached); setLoading(false) }
      supabase
        .from('items')
        .select('id, created_at, name, acquired_year, acquired_location, acquired_lat, acquired_lng')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setItems(data)
          setLoading(false)
        })
      supabase
        .from('profiles')
        .select('username')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => setUsername(data?.username ?? null))
    })
  }, [navigate])

  const targetSlug = username ?? session?.user.id ?? ''

  function goWith(params) {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v != null && v !== '') qs.set(k, String(v))
    navigate(`/u/${targetSlug}${qs.toString() ? `?${qs.toString()}` : ''}`)
  }

  const stats = useMemo(() => {
    const byDay = bucketize(items, dayKey)
    const byWeek = bucketize(items, weekKey)
    const byMonth = bucketize(items, monthKey)
    const streak = computeStreak(byDay)
    const longest = computeLongestStreak(byDay)
    let bestDayKey = null, bestDayCount = 0
    for (const [k, v] of byDay) if (v > bestDayCount) { bestDayKey = k; bestDayCount = v }
    return { byDay, byWeek, byMonth, streak, longest, bestDayKey, bestDayCount }
  }, [items])

  const yearStats = useMemo(() => {
    const years = items.map(i => i.acquired_year).filter(y => y != null)
    if (years.length === 0) return null
    const min = Math.min(...years)
    const max = Math.max(...years)
    const range = max - min
    const bucketSize = range > 30 ? 5 : 1
    const buckets = new Map()
    for (const y of years) {
      const bucket = Math.floor(y / bucketSize) * bucketSize
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1)
    }
    const startBucket = Math.floor(min / bucketSize) * bucketSize
    const endBucket = Math.floor(max / bucketSize) * bucketSize
    const bars = []
    for (let b = startBucket; b <= endBucket; b += bucketSize) {
      bars.push({ key: b, label: bucketSize === 1 ? `'${String(b).slice(2)}` : String(b), count: buckets.get(b) ?? 0 })
    }
    const maxCount = Math.max(...bars.map(b => b.count))
    return { bars, max: maxCount, bucketSize }
  }, [items])

  const mapMarkers = useMemo(() => {
    return items
      .filter(i => i.acquired_lat != null && i.acquired_lng != null)
      .map(i => ({
        id: i.id,
        lat: i.acquired_lat,
        lng: i.acquired_lng,
        city: cityOf(i.acquired_location),
        title: i.name || cityOf(i.acquired_location) || 'item',
        subtitle: [i.acquired_year, i.acquired_location?.split(',').slice(1, 3).join(',').trim()].filter(Boolean).join(' · '),
      }))
  }, [items])

  const topCities = useMemo(() => {
    const counts = new Map()
    for (const i of items) {
      const c = cityOf(i.acquired_location)
      if (!c) continue
      counts.set(c, (counts.get(c) ?? 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12)
  }, [items])

  const topCitiesMax = topCities.length > 0 ? Math.max(...topCities.map(c => c.count)) : 0

  const mapBounds = useMemo(() => {
    if (mapMarkers.length === 0) return null
    return mapMarkers.map(m => [m.lat, m.lng])
  }, [mapMarkers])

  if (loading) {
    return <div className="centered"><div className="spinner" /></div>
  }

  const days = lastNDays(30)
  const weeks = lastNWeeks(12)
  const months = lastNMonths(12)
  const dayMax = Math.max(0, ...days.map(d => stats.byDay.get(dayKey(d)) ?? 0))
  const weekMax = Math.max(0, ...weeks.map(d => stats.byWeek.get(weekKey(d)) ?? 0))
  const monthMax = Math.max(0, ...months.map(d => stats.byMonth.get(monthKey(d)) ?? 0))

  const bestDayDate = stats.bestDayKey ? new Date(stats.bestDayKey) : null

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1 className="profile-name">stats</h1>
          <p className="profile-username-readonly">your collection over time</p>
        </div>
        <Link to="/" className="link-btn" style={{ marginTop: 8 }}>things</Link>
      </header>

      {items.length === 0 ? (
        <div className="centered" style={{ flexDirection: 'column', gap: 16, height: 'auto', padding: '80px 0' }}>
          <p style={{ color: '#999' }}>nothing to show yet</p>
        </div>
      ) : (
        <>
          <div className="stats-summary">
            <div className="stats-card">
              <div className="stats-card-label">total</div>
              <div className="stats-card-value">{items.length}</div>
              <div className="stats-card-sub">{items.length === 1 ? 'object' : 'objects'}</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">current streak</div>
              <div className="stats-card-value">{stats.streak}</div>
              <div className="stats-card-sub">{stats.streak === 1 ? 'day' : 'days'}</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">longest streak</div>
              <div className="stats-card-value">{stats.longest}</div>
              <div className="stats-card-sub">{stats.longest === 1 ? 'day' : 'days'}</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">best day</div>
              <div className="stats-card-value">{stats.bestDayCount}</div>
              <div className="stats-card-sub">
                {bestDayDate ? `${MONTH_NAMES[bestDayDate.getMonth()].toLowerCase()} ${bestDayDate.getDate()}, ${bestDayDate.getFullYear()}` : '—'}
              </div>
            </div>
          </div>

          <section className="stats-section">
            <h2 className="stats-section-title">last 30 days</h2>
            <div className="stats-chart">
              {days.map((d, i) => {
                const k = dayKey(d)
                const count = stats.byDay.get(k) ?? 0
                return (
                  <Bar
                    key={k}
                    count={count}
                    max={dayMax}
                    label={formatDayLabel(d, i, days.length)}
                    title={`${k}: ${count}`}
                    onClick={() => goWith({ from: k, to: k })}
                  />
                )
              })}
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">last 12 weeks</h2>
            <div className="stats-chart">
              {weeks.map(d => {
                const k = weekKey(d)
                const count = stats.byWeek.get(k) ?? 0
                return (
                  <Bar
                    key={k}
                    count={count}
                    max={weekMax}
                    label={formatWeekLabel(d)}
                    title={`week of ${k}: ${count}`}
                    onClick={() => goWith({ from: k, to: endOfWeekKey(k) })}
                  />
                )
              })}
            </div>
          </section>

          <section className="stats-section">
            <h2 className="stats-section-title">last 12 months</h2>
            <div className="stats-chart">
              {months.map(d => {
                const k = monthKey(d)
                const count = stats.byMonth.get(k) ?? 0
                return (
                  <Bar
                    key={k}
                    count={count}
                    max={monthMax}
                    label={formatMonthLabel(d)}
                    title={`${k}: ${count}`}
                    onClick={() => goWith({ from: `${k}-01`, to: endOfMonthKey(k) })}
                  />
                )
              })}
            </div>
          </section>

          {yearStats && (
            <section className="stats-section">
              <h2 className="stats-section-title">
                acquisition {yearStats.bucketSize === 1 ? 'years' : `${yearStats.bucketSize}-year periods`}
              </h2>
              <div className="stats-chart">
                {yearStats.bars.map(b => (
                  <Bar
                    key={b.key}
                    count={b.count}
                    max={yearStats.max}
                    label={b.label}
                    title={`${b.label}: ${b.count}`}
                    onClick={() => goWith(
                      yearStats.bucketSize === 1
                        ? { year: b.key }
                        : { yearMin: b.key, yearMax: b.key + yearStats.bucketSize - 1 }
                    )}
                  />
                ))}
              </div>
            </section>
          )}

          {topCities.length > 0 && (
            <section className="stats-section">
              <h2 className="stats-section-title">top cities</h2>
              <div className="stats-chart">
                {topCities.map(c => (
                  <Bar
                    key={c.name}
                    count={c.count}
                    max={topCitiesMax}
                    label={c.name}
                    title={`${c.name}: ${c.count}`}
                    onClick={() => goWith({ city: c.name })}
                  />
                ))}
              </div>
            </section>
          )}

          {mapMarkers.length > 0 && (
            <section className="stats-section">
              <h2 className="stats-section-title">acquired around the world</h2>
              <div className="stats-map">
                <MapContainer
                  bounds={mapBounds}
                  boundsOptions={{ padding: [40, 40] }}
                  scrollWheelZoom={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {mapMarkers.map(m => (
                    <Marker key={m.id} position={[m.lat, m.lng]} icon={markerIcon}>
                      <Popup>
                        <strong>{m.title}</strong>
                        {m.subtitle && <><br />{m.subtitle}</>}
                        {m.city && (
                          <><br /><a
                            href="#"
                            onClick={e => { e.preventDefault(); goWith({ city: m.city }) }}
                          >see all from {m.city}</a></>
                        )}
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              <p className="stats-map-caption">
                {mapMarkers.length} object{mapMarkers.length === 1 ? '' : 's'} with a known location
              </p>
            </section>
          )}
        </>
      )}
    </div>
  )
}
