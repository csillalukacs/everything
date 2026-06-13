import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { searchPlaces } from '../lib/geocode'
import { S } from '../../../shared/strings'

export default function LocationPicker({ value, onChange, placeholder = S.location.defaultPlaceholder, suggestions = [] }) {
  const [query, setQuery] = useState(value?.location ?? '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const [menuRect, setMenuRect] = useState(null)
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)
  const rowRef = useRef(null)

  useEffect(() => {
    setQuery(value?.location ?? '')
  }, [value?.location])

  function handleChange(text) {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = text.trim()
    if (!trimmed) {
      setResults([])
      setLoading(false)
      onChange(null)
      return
    }
    const lower = trimmed.toLowerCase()
    const local = suggestions
      .filter(s => s.location?.toLowerCase().includes(lower))
      .slice(0, 5)
      .map(s => ({ display_name: s.location, lat: s.lat, lng: s.lng }))
    if (local.length > 0) {
      setResults(local)
      setLoading(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      const myReq = ++reqIdRef.current
      const places = await searchPlaces(text)
      if (myReq !== reqIdRef.current) return
      setResults(places)
      setLoading(false)
    }, 400)
  }

  function pick(place) {
    setQuery(place.display_name)
    setResults([])
    setFocused(false)
    onChange({ location: place.display_name, lat: place.lat, lng: place.lng })
  }

  function clear() {
    setQuery('')
    setResults([])
    onChange(null)
  }

  const hasCoords = !!value?.lat && !!value?.lng
  const showResults = focused && results.length > 0

  // The dropdown renders in a portal with fixed positioning so it can spill
  // outside the modal (which clips via overflow) instead of reserving space.
  useEffect(() => {
    if (!showResults) return
    const update = () => {
      const el = rowRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setMenuRect({ left: r.left, top: r.bottom + 6, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [showResults])

  return (
    <div className="location-picker">
      <div className="location-picker-input-row" ref={rowRef}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasCoords ? '#111111' : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <input
          type="text"
          className="location-picker-input"
          placeholder={placeholder}
          value={query}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          autoCorrect="off"
          autoCapitalize="words"
        />
        {loading
          ? <div className="spinner" style={{ width: 14, height: 14, borderWidth: 1.5 }} />
          : query.length > 0 && (
            <button type="button" className="location-picker-clear" onClick={clear} aria-label={S.a11y.clear}>×</button>
          )}
      </div>
      {showResults && menuRect && createPortal(
        <div
          className="location-picker-results"
          style={{ position: 'fixed', left: menuRect.left, top: menuRect.top, width: menuRect.width, right: 'auto' }}
        >
          {results.map((r, i) => (
            <button
              type="button"
              key={`${r.lat},${r.lng},${i}`}
              className="location-picker-result"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(r)}
            >{r.display_name}</button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}
