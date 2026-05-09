import { useEffect, useRef, useState } from 'react'
import { searchPlaces } from '../lib/geocode'
import { S } from '../../../shared/strings'

export default function LocationPicker({ value, onChange, placeholder = S.location.defaultPlaceholder }) {
  const [query, setQuery] = useState(value?.location ?? '')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [focused, setFocused] = useState(false)
  const debounceRef = useRef(null)
  const reqIdRef = useRef(0)

  useEffect(() => {
    setQuery(value?.location ?? '')
  }, [value?.location])

  function handleChange(text) {
    setQuery(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!text.trim()) {
      setResults([])
      setLoading(false)
      onChange(null)
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

  return (
    <div className="location-picker">
      <div className="location-picker-input-row">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={hasCoords ? '#2D2D2D' : '#bbb'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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
      {showResults && (
        <div className="location-picker-results">
          {results.map((r, i) => (
            <button
              type="button"
              key={`${r.lat},${r.lng},${i}`}
              className="location-picker-result"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(r)}
            >{r.display_name}</button>
          ))}
        </div>
      )}
    </div>
  )
}
