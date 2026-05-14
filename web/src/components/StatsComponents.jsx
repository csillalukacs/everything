export function Bar({ count, max, label, title, onClick }) {
  const heightPct = max > 0 ? (count / max) * 100 : 0
  const interactive = !!onClick && count > 0
  const Tag = interactive ? 'button' : 'div'
  return (
    <Tag
      className={`stats-bar-col${interactive ? ' stats-bar-col-clickable' : ''}`}
      title={title}
      onClick={interactive ? onClick : undefined}
      type={interactive ? 'button' : undefined}
    >
      <div className="stats-bar-track">
        {count > 0 && (
          <div className="stats-bar-fill" style={{ height: `${Math.max(heightPct, 2)}%` }}>
            <span className="stats-bar-value">{count}</span>
          </div>
        )}
      </div>
      <span className="stats-bar-label">{label}</span>
    </Tag>
  )
}

export function PieChart({ slices, total, size = 240, hoveredKey, onHover }) {
  const r = size / 2 - 1
  const cx = size / 2
  const cy = size / 2
  if (slices.length === 1) {
    const sliceKey = `${slices[0].kind}:${slices[0].label}`
    return (
      <svg width={size} height={size} className="stats-pie-svg">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill={slices[0].color}
          className={`stats-pie-slice${hoveredKey === sliceKey ? ' stats-pie-slice-hover' : ''}`}
          onMouseEnter={() => onHover?.(sliceKey)}
          onMouseLeave={() => onHover?.(null)}
        />
      </svg>
    )
  }
  let cumAngle = -Math.PI / 2
  return (
    <svg width={size} height={size} className="stats-pie-svg">
      {slices.map(slice => {
        const angle = (slice.count / total) * Math.PI * 2
        const startAngle = cumAngle
        const endAngle = cumAngle + angle
        cumAngle = endAngle
        const x1 = cx + r * Math.cos(startAngle)
        const y1 = cy + r * Math.sin(startAngle)
        const x2 = cx + r * Math.cos(endAngle)
        const y2 = cy + r * Math.sin(endAngle)
        const largeArc = angle > Math.PI ? 1 : 0
        const d = `M ${cx},${cy} L ${x1},${y1} A ${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`
        const sliceKey = `${slice.kind}:${slice.label}`
        return (
          <path
            key={sliceKey}
            d={d}
            fill={slice.color}
            className={`stats-pie-slice${hoveredKey === sliceKey ? ' stats-pie-slice-hover' : ''}`}
            onMouseEnter={() => onHover?.(sliceKey)}
            onMouseLeave={() => onHover?.(null)}
          />
        )
      })}
    </svg>
  )
}
