import { avatarColor, avatarInitial, avatarSrc } from '../../../shared/avatar'

export default function Avatar({ profile, size = 40, className = '', style }) {
  const src = avatarSrc(profile)
  const dims = { width: size, height: size, borderRadius: '50%' }
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={`avatar-image ${className}`.trim()}
        style={{ ...dims, objectFit: 'cover', ...style }}
      />
    )
  }
  return (
    <div
      className={`avatar-placeholder ${className}`.trim()}
      style={{
        ...dims,
        backgroundColor: avatarColor(profile),
        fontSize: Math.round(size * 0.45),
        ...style,
      }}
    >
      {avatarInitial(profile)}
    </div>
  )
}
