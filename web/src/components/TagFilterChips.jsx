import { S } from '../../../shared/strings'
import LockIcon from './LockIcon'
import { SettingsIcon } from './Icons'

export default function TagFilterChips({
  tags,
  activeTag,
  onChangeActiveTag,
  totalCount,
  untaggedCount,
  tagCounts,
  showUntagged = false,
  onManagePress,
}) {
  if (tags.length === 0) return null
  const isUntagged = activeTag?.id === '__untagged__'
  const scroll = (
    <div className="filter-scroll">
      <button
        className={`chip${!activeTag ? ' chip-active' : ''}`}
        onClick={() => onChangeActiveTag(null)}
      >{S.common.all}<span className="chip-count">{totalCount}</span></button>
      {showUntagged && (
        <button
          className={`chip${isUntagged ? ' chip-active' : ''}`}
          onClick={() => onChangeActiveTag(isUntagged ? null : { id: '__untagged__' })}
        >{S.collection.untagged}<span className="chip-count">{untaggedCount}</span></button>
      )}
      {tags.map(tag => (
        <button
          key={tag.id}
          className={`chip${activeTag?.id === tag.id ? ' chip-active' : ''}`}
          onClick={() => onChangeActiveTag(activeTag?.id === tag.id ? null : tag)}
        >{tag.is_private && <LockIcon size={10} color="currentColor" />}{tag.name}<span className="chip-count">{tagCounts.get(tag.id) ?? 0}</span></button>
      ))}
    </div>
  )
  if (!onManagePress) return scroll
  return (
    <div className="filter-row">
      {scroll}
      <button className="chip filter-manage-btn" onClick={onManagePress} aria-label={S.common.manage}>
        <SettingsIcon size={18} color="#999" />
      </button>
    </div>
  )
}
