import { useEffect, useRef, useState } from 'react'
import { S } from '../../../shared/strings'
import { FEATURED_TAG_NAME } from '../../../shared/featuredTag'
import LockIcon from '../components/LockIcon'
import { AppleIcon } from '../components/Icons'

export default function TagInput({ value = [], onChange, allTags = [], placeholder = S.tagInput.defaultPlaceholder }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  const tagPrivacyMap = Object.fromEntries(
    allTags.filter(t => typeof t === 'object').map(t => [t.name, t.is_private])
  )
  const allTagNames = allTags.map(t => (typeof t === 'string' ? t : t.name))

  const trimmedQuery = query.trim().toLowerCase()
  const available = allTagNames.filter(n => !value.includes(n))
  const matchesRaw = trimmedQuery
    ? available.filter(n => n.includes(trimmedQuery))
    : available
  const matches = matchesRaw.slice().sort((a, b) => {
    if (a === FEATURED_TAG_NAME) return -1
    if (b === FEATURED_TAG_NAME) return 1
    return 0
  })
  const exactExists = trimmedQuery && allTagNames.includes(trimmedQuery)
  const canCreate = trimmedQuery && !exactExists && !value.includes(trimmedQuery)
  const totalOptions = matches.length + (canCreate ? 1 : 0)

  useEffect(() => {
    setHighlight(0)
  }, [query, focused])

  function add(tag) {
    const t = tag.trim().toLowerCase()
    if (!t || value.includes(t)) return
    onChange([...value, t])
    setQuery('')
    setHighlight(0)
  }

  function remove(tag) {
    onChange(value.filter(t => t !== tag))
  }

  function handleKeyDown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, totalOptions - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (highlight < matches.length) {
        if (matches[highlight]) add(matches[highlight])
      } else if (canCreate) {
        add(trimmedQuery)
      } else if (trimmedQuery) {
        add(trimmedQuery)
      }
    } else if (e.key === 'Backspace' && !query && value.length > 0) {
      remove(value[value.length - 1])
    } else if (e.key === 'Escape') {
      setFocused(false)
      inputRef.current?.blur()
    }
  }

  const showDropdown = focused && totalOptions > 0

  return (
    <div className="tag-input" ref={wrapRef}>
      <div className="tag-input-row" onClick={() => inputRef.current?.focus()}>
        {value.map(tag => {
          const isPriv = tagPrivacyMap[tag]
          const featured = tag === FEATURED_TAG_NAME
          return (
            <span key={tag} className="tag-input-chip">
              {featured && <AppleIcon size={12} />}
              {isPriv && !featured && <LockIcon size={10} color="#fff" />}
              {tag}
              <button
                type="button"
                className="tag-input-chip-x"
                onMouseDown={e => e.preventDefault()}
                onClick={() => remove(tag)}
                aria-label={S.tagInput.removeTag(tag)}
              >×</button>
            </span>
          )
        })}
        <input
          ref={inputRef}
          className="tag-input-field"
          value={query}
          onChange={e => setQuery(e.target.value.toLowerCase())}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ''}
        />
      </div>
      {showDropdown && (
        <div className="tag-input-dropdown">
          {matches.map((name, i) => {
            const isPriv = tagPrivacyMap[name]
            const featured = name === FEATURED_TAG_NAME
            return (
              <button
                type="button"
                key={name}
                className={`tag-input-option${i === highlight ? ' tag-input-option-active' : ''}`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => add(name)}
                onMouseEnter={() => setHighlight(i)}
              >
                {featured && <AppleIcon size={12} />}
                {isPriv && !featured && <LockIcon size={10} color="#bbb" />}
                {name}
              </button>
            )
          })}
          {canCreate && (
            <button
              type="button"
              className={`tag-input-option tag-input-option-create${highlight === matches.length ? ' tag-input-option-active' : ''}`}
              onMouseDown={e => e.preventDefault()}
              onClick={() => add(trimmedQuery)}
              onMouseEnter={() => setHighlight(matches.length)}
            >
              {S.tagInput.createTag(trimmedQuery)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
