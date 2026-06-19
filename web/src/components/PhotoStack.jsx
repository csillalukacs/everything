// A right-aligned fan of thumbnails for a collapsed feed/notification row. The
// first thumb sits on top; a "+N" chip stands in for any beyond `max`. Purely
// presentational — the enclosing row owns the click.
export default function PhotoStack({ thumbs, size = 80, max = 3 }) {
  const shown = thumbs.slice(0, max)
  const overflow = thumbs.length - shown.length
  const offset = Math.round(size * 0.22)
  const layers = shown.length + (overflow > 0 ? 1 : 0)
  const cell = { width: size, height: size, borderRadius: Math.round(size / 6) }
  return (
    <div className="photo-stack" style={{ width: size + (layers - 1) * offset, height: size }}>
      {shown.map((uri, i) => (
        <img
          key={uri + i}
          src={uri}
          alt=""
          className="photo-stack-cell"
          style={{ ...cell, right: i * offset, zIndex: max - i }}
        />
      ))}
      {overflow > 0 && (
        <div className="photo-stack-cell photo-stack-more" style={{ ...cell, right: shown.length * offset }}>
          +{overflow}
        </div>
      )}
    </div>
  )
}
