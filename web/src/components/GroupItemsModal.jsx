import { thumbOf } from '../../../shared/items'

// The full list behind a collapsed feed/notification row's photo stack — a grid
// of thumbnails. Clicking one calls `onItemPress` (the parent opens that item).
export default function GroupItemsModal({ open, onClose, title, items = [], onItemPress }) {
  if (!open) return null
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal group-items-modal">
        <div className="modal-header">
          <button className="link-btn" onClick={onClose}>✕</button>
          <h2 className="follow-list-title">{title}</h2>
          <span className="follow-list-header-spacer" />
        </div>
        <div className="group-items-grid">
          {items.map(item => {
            const thumb = thumbOf(item)
            return (
              <button
                key={item.id}
                type="button"
                className="group-items-tile-btn"
                onClick={() => onItemPress?.(item)}
              >
                {thumb
                  ? <img src={thumb} alt="" className="group-items-tile" />
                  : <span className="group-items-tile" />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
