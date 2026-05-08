import { useEffect, useRef, useState } from 'react'

export default function FilterDropdown({ value, options, onChange, active = false, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef(null)
  const btnRef = useRef(null)

  const normValue = value ?? ''
  const currentIdx = Math.max(0, options.findIndex(o => o.value === normValue))
  const current = options[currentIdx] ?? options[0]

  useEffect(() => {
    if (open) setHighlight(currentIdx)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    function onDocMouseDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') { setOpen(false); btnRef.current?.focus() }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, options.length - 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)) }
      else if (e.key === 'Enter') { e.preventDefault(); pick(options[highlight]) }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, highlight, options])

  function pick(opt) {
    if (!opt) return
    setOpen(false)
    onChange(opt.value)
  }

  return (
    <div className="filter-dropdown" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={`filter-select filter-select-btn${active ? ' filter-select-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="filter-select-stack">
          {options.map(opt => (
            <span key={opt.value} className="filter-select-ghost" aria-hidden="true">{opt.label}</span>
          ))}
          <span className="filter-select-label">{current?.label ?? ''}</span>
        </span>
        <svg className="filter-select-caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="filter-dropdown-menu" role="listbox">
          {options.map((opt, i) => (
            <button
              type="button"
              key={opt.value}
              role="option"
              aria-selected={opt.value === current.value}
              className={`filter-dropdown-option${i === highlight ? ' filter-dropdown-option-active' : ''}${opt.value === current.value ? ' filter-dropdown-option-selected' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(opt)}
              onMouseEnter={() => setHighlight(i)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
