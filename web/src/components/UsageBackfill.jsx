import { dayKey, lastNDays, MONTH_NAMES } from '../../../shared/dates'
import { S } from '../../../shared/strings'

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

// Backfill grid: the last 30 days as toggleable day chips. Tapping a day logs or removes
// a silent (no-feed) usage. `usedDays` is a Set of 'YYYY-MM-DD' keys.
export default function UsageBackfill({ usedDays, onToggle }) {
  const days = lastNDays(30).slice().reverse() // newest first
  return (
    <div className="backfill">
      <div className="backfill-title">{S.usage.backfillTitle}</div>
      <div className="backfill-hint">{S.usage.backfillHint}</div>
      <div className="backfill-grid">
        {days.map(d => {
          const key = dayKey(d)
          const used = usedDays.has(key)
          return (
            <button
              key={key}
              type="button"
              className={`backfill-chip${used ? ' backfill-chip-on' : ''}`}
              onClick={() => onToggle(key, !used)}
            >
              <span className="backfill-chip-weekday">{WEEKDAYS[d.getDay()]}</span>
              <span className="backfill-chip-day">{d.getDate()}</span>
              <span className="backfill-chip-month">{MONTH_NAMES[d.getMonth()].toLowerCase()}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
