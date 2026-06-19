// A left-anchored fan of thumbnails for a collapsed feed/notification row. Thumbs
// fan out to the right with the "+N" chip last (right end). When `onPress` is
// given the whole stack is a button (opens the full-list modal); otherwise the
// enclosing row owns the click.
//
// `total` is the real item count when it exceeds the thumbnails passed in (some
// items may lack a thumb); it drives the "+N" so the modal count stays honest.
export default function PhotoStack({ thumbs, total, size = 80, max = 3, onPress }) {
  const shown = thumbs.slice(0, max)
  const overflow = (total ?? thumbs.length) - shown.length
  const offset = Math.round(size * 0.22)
  const layers = shown.length + (overflow > 0 ? 1 : 0)
  const cell = { width: size, height: size, borderRadius: Math.round(size / 6) }
  const width = size + (layers - 1) * offset

  const content = (
    <>
      {shown.map((uri, i) => (
        <img
          key={uri + i}
          src={uri}
          alt=""
          className="photo-stack-cell"
          style={{ ...cell, left: i * offset, zIndex: i }}
        />
      ))}
      {overflow > 0 && (
        <span className="photo-stack-cell photo-stack-more" style={{ ...cell, left: shown.length * offset, zIndex: layers }}>
          +{overflow}
        </span>
      )}
    </>
  )

  if (onPress) {
    return (
      <button
        type="button"
        className="photo-stack photo-stack-btn"
        style={{ width, height: size }}
        onClick={e => { e.stopPropagation(); onPress() }}
      >
        {content}
      </button>
    )
  }
  return <div className="photo-stack" style={{ width, height: size }}>{content}</div>
}
