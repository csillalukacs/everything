import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

function Bar({ count, max, label, title }) {
  const heightPct = max > 0 ? (count / max) * 100 : 0
  return (
    <div className="stats-bar-col" title={title}>
      <div className="stats-bar-track">
        {count > 0 && (
          <div className="stats-bar-fill" style={{ height: `${Math.max(heightPct, 2)}%` }}>
            <span className="stats-bar-value">{count}</span>
          </div>
        )}
      </div>
      <span className="stats-bar-label">{label}</span>
    </div>
  )
}

export default function StatsPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/'); return }
      setSession(session)
      const cached = readCache(itemsCacheKey(session.user.id))
      if (cached) { setItems(cached); setLoading(false) }
      supabase
        .from('items')
        .select('id, created_at')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => {
          if (data) setItems(data)
          setLoading(false)
        })
    })
  }, [navigate])

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
                  />
                )
              })}
            </div>
          </section>
        </>
      )}
    </div>
  )
}
