import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { supabase } from '../lib/supabase'
import { fetchAllItems, fetchItemCount } from '../../../shared/itemsApi'
import {
  MONTH_NAMES,
  dayKey,
  weekKey,
  monthKey,
  lastNDays,
  lastNWeeks,
  lastNMonths,
  bucketize,
  computeStreak,
  computeLongestStreak,
  formatDayLabel,
  formatWeekLabel,
  formatMonthLabel,
  endOfWeekKey,
  endOfMonthKey,
} from '../../../shared/dates'
import { cityOf, thumbOf } from '../../../shared/items'
import { S } from '../../../shared/strings'
import { buildTagDistribution, computeYearStats, buildMapGroups } from '../../../shared/stats'
import { itemsCacheKey } from '../../../shared/cacheKeys'
import { readCache } from '../lib/cache'
import { Bar, PieChart } from '../components/StatsComponents'

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

const homeIcon = L.divIcon({
  className: 'home-marker',
  html: '<div class="home-marker-dot"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

export default function StatsPage() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [items, setItems] = useState([])
  const [itemCount, setItemCount] = useState(null)
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState(null)
  const [home, setHome] = useState(null)
  const [hoveredSliceKey, setHoveredSliceKey] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate('/'); return }
      setSession(session)
      const cached = readCache(itemsCacheKey(session.user.id))
      if (cached) { setItems(cached); setLoading(false) }
      fetchItemCount(supabase, { userId: session.user.id })
        .then(setItemCount)
        .catch(e => console.error('fetchItemCount error:', e))
      fetchAllItems(supabase, {
        userId: session.user.id,
        columns: 'id, created_at, name, image_url, thumb_url, acquired_year, acquired_location, acquired_lat, acquired_lng, tags(id, name)',
      })
        .then(data => { setItems(data); setLoading(false) })
        .catch(e => { console.error('fetchAllItems error:', e); setLoading(false) })
      supabase
        .from('profiles')
        .select('username, home_location, home_lat, home_lng')
        .eq('user_id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          setUsername(data?.username ?? null)
          if (data?.home_lat != null && data?.home_lng != null) {
            setHome({ lat: data.home_lat, lng: data.home_lng, location: data.home_location })
          } else {
            setHome(null)
          }
        })
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

  const yearStats = useMemo(() => computeYearStats(items), [items])
  const mapGroups = useMemo(() => buildMapGroups(items), [items])
  const tagDistribution = useMemo(() => buildTagDistribution(items), [items])

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
    if (mapGroups.length === 0) return null
    const pts = mapGroups.map(g => [g.lat, g.lng])
    if (home) pts.push([home.lat, home.lng])
    return pts
  }, [mapGroups, home])

  const totalLocatedItems = useMemo(
    () => mapGroups.reduce((sum, g) => sum + g.count, 0),
    [mapGroups]
  )

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
          <h1 className="profile-name">{S.stats.title}</h1>
          <p className="profile-username-readonly">{S.stats.subtitle}</p>
        </div>
        <div className="header-links" style={{ marginTop: 8 }}>
          <Link to={`/u/${targetSlug}`} className="link-btn">{S.feed.myCollection}</Link>
          <Link to="/" className="link-btn">{S.appName}</Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="centered" style={{ flexDirection: 'column', gap: 16, height: 'auto', padding: '80px 0' }}>
          <p style={{ color: '#999' }}>{S.stats.empty}</p>
        </div>
      ) : (
        <>
          <div className="stats-summary">
            <div className="stats-card">
              <div className="stats-card-label">{S.stats.total}</div>
              <div className="stats-card-value">{itemCount ?? items.length}</div>
              <div className="stats-card-sub">{S.stats.objectsLabel(itemCount ?? items.length)}</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">{S.stats.streakWeb}</div>
              <div className="stats-card-value">{stats.streak}</div>
              <div className="stats-card-sub">{S.stats.daysLabel(stats.streak)}</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">{S.stats.longestWeb}</div>
              <div className="stats-card-value">{stats.longest}</div>
              <div className="stats-card-sub">{S.stats.daysLabel(stats.longest)}</div>
            </div>
            <div className="stats-card">
              <div className="stats-card-label">{S.stats.bestDay}</div>
              <div className="stats-card-value">{stats.bestDayCount}</div>
              <div className="stats-card-sub">
                {bestDayDate ? `${MONTH_NAMES[bestDayDate.getMonth()].toLowerCase()} ${bestDayDate.getDate()}, ${bestDayDate.getFullYear()}` : '—'}
              </div>
            </div>
          </div>

          <section className="stats-section">
            <h2 className="stats-section-title">{S.stats.last30Days}</h2>
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

          <div className="stats-row">
            <section className="stats-section">
              <h2 className="stats-section-title">{S.stats.last12Weeks}</h2>
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
              <h2 className="stats-section-title">{S.stats.last12Months}</h2>
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
          </div>

          {(yearStats || topCities.length > 0) && (
            <div className="stats-row">
              {yearStats && (
                <section className="stats-section">
                  <h2 className="stats-section-title">{S.stats.acquisitionTitle(yearStats.bucketSize)}</h2>
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
                  <h2 className="stats-section-title">{S.stats.topCities}</h2>
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
            </div>
          )}

          {(mapGroups.length > 0 || tagDistribution) && (() => {
            const hoveredSlice = tagDistribution?.slices.find(s => `${s.kind}:${s.label}` === hoveredSliceKey)
            return (
              <div className="stats-row">
                {tagDistribution && (
                  <section className="stats-section stats-row-pie">
                    <h2 className="stats-section-title">{S.stats.tags}</h2>
                    <div className="stats-pie-wrap">
                      <div className="stats-pie-chart">
                        <PieChart
                          slices={tagDistribution.slices}
                          total={tagDistribution.total}
                          hoveredKey={hoveredSliceKey}
                          onHover={setHoveredSliceKey}
                        />
                        {hoveredSlice && (
                          <div className="stats-pie-tooltip">
                            <div className="stats-pie-tooltip-label">{hoveredSlice.label}</div>
                            <div className="stats-pie-tooltip-value">
                              {hoveredSlice.count} · {Math.round((hoveredSlice.count / tagDistribution.total) * 100)}%
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="stats-pie-legend">
                        {tagDistribution.slices.map(s => {
                          const pct = Math.round((s.count / tagDistribution.total) * 100)
                          const interactive = s.kind === 'tag' || s.kind === 'untagged'
                          const sliceKey = `${s.kind}:${s.label}`
                          const onClick = interactive
                            ? () => goWith({ tag: s.kind === 'untagged' ? '__untagged__' : s.label })
                            : undefined
                          const Tag = interactive ? 'button' : 'div'
                          return (
                            <Tag
                              key={sliceKey}
                              className={`stats-pie-legend-row${interactive ? ' stats-pie-legend-row-clickable' : ''}${hoveredSliceKey === sliceKey ? ' stats-pie-legend-row-hover' : ''}`}
                              onClick={onClick}
                              onMouseEnter={() => setHoveredSliceKey(sliceKey)}
                              onMouseLeave={() => setHoveredSliceKey(null)}
                              type={interactive ? 'button' : undefined}
                              title={`${s.label}: ${s.count} (${pct}%)`}
                            >
                              <span className="stats-pie-swatch" style={{ background: s.color }} />
                              <span className="stats-pie-legend-label">{s.label}</span>
                              <span className="stats-pie-legend-value">{pct}%</span>
                            </Tag>
                          )
                        })}
                      </div>
                    </div>
                  </section>
                )}
                {mapGroups.length > 0 && (
                  <section className="stats-section stats-row-map">
                    <h2 className="stats-section-title">{S.stats.acquiredAroundWorld}</h2>
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
                  {home && mapGroups.map(g => (
                    <Polyline
                      key={`line-${g.key}`}
                      positions={[[home.lat, home.lng], [g.lat, g.lng]]}
                      pathOptions={{ color: '#2D2D2D', weight: 1, opacity: 0.35 }}
                    />
                  ))}
                  {mapGroups.map(g => (
                    <Marker key={g.key} position={[g.lat, g.lng]} icon={markerIcon}>
                      <Popup>
                        <div className="map-popup">
                          <div className="map-popup-title">{g.city || S.stats.unnamedLocation}</div>
                          <div className="map-popup-sub">
                            {S.stats.objectCountWithRegion(g.count, g.regionLabel)}
                          </div>
                          {g.samples.length > 0 && (
                            <div className="map-popup-thumbs">
                              {g.samples.map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className="map-popup-thumb"
                                  onClick={() => goWith({ item: s.id })}
                                  title={s.name || ''}
                                >
                                  {s.image_url
                                    ? <img src={thumbOf(s)} alt={s.name || ''} />
                                    : <div className="map-popup-thumb-placeholder" />
                                  }
                                </button>
                              ))}
                            </div>
                          )}
                          {g.city && (
                            <a
                              href="#"
                              className="map-popup-link"
                              onClick={e => { e.preventDefault(); goWith({ city: g.city }) }}
                            >{S.stats.seeAllFromWeb(g.city)}</a>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {home && (
                    <Marker position={[home.lat, home.lng]} icon={homeIcon}>
                      <Popup>
                        <strong>{S.stats.home}</strong>
                        {home.location && <><br />{home.location.split(',')[0]}</>}
                      </Popup>
                    </Marker>
                  )}
                </MapContainer>
              </div>
                    <p className="stats-map-caption">
                      {S.stats.mapCaption(totalLocatedItems, mapGroups.length)}
                      {home ? S.stats.connectedTo(home.location?.split(',')[0]) : ''}
                    </p>
                  </section>
                )}
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
