import { useEffect, useRef, useState } from 'react'
import { S } from '../../../shared/strings'
import { SearchIcon } from './Icons'

export default function SearchBar({ value, onChange }) {
  const [helpOpen, setHelpOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!helpOpen) return
    function onDocClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setHelpOpen(false)
    }
    function onKey(e) { if (e.key === 'Escape') setHelpOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [helpOpen])

  return (
    <div className="search-container" ref={ref}>
      <SearchIcon className="search-icon" />
      <input
        type="text"
        className="search-input"
        placeholder={S.common.search}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')} aria-label={S.a11y.clearSearch}>×</button>
      )}
      <button
        type="button"
        className={`search-help-button${helpOpen ? ' search-help-button-active' : ''}`}
        onClick={() => setHelpOpen(v => !v)}
        aria-label={S.a11y.searchHelp}
        aria-expanded={helpOpen}
      >?</button>
      {helpOpen && (
        <div className="search-help-popover" role="dialog" aria-label={S.searchHelp.title}>
          <div className="search-help-title">{S.searchHelp.title}</div>
          <div className="search-help-intro">{S.searchHelp.intro}</div>
          <ul className="search-help-list">
            {S.searchHelp.examples.map(ex => (
              <li key={ex.code}>
                <button
                  type="button"
                  className="search-help-code"
                  onClick={() => {
                    onChange(ex.code)
                    setHelpOpen(false)
                  }}
                >{ex.code}</button>
                <span className="search-help-desc">{ex.desc}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
