import { S } from '../../../shared/strings'
import { isFeaturedTag, sortTagsFeaturedFirst } from '../../../shared/featuredTag'
import LockIcon from './LockIcon'
import { AppleIcon, SettingsIcon } from './Icons'

export default function TagFilterChips({
  tags,
  activeTag,
  onChangeActiveTag,
  totalCount,
  untaggedCount,
  tagCounts,
  showUntagged = false,
  showAll = true,
  onManagePress,
}) {
  if (tags.length === 0) return null
  const isUntagged = activeTag?.id === '__untagged__'
  const orderedTags = sortTagsFeaturedFirst(tags)
  const featuredTag = orderedTags.find(isFeaturedTag)
  const otherTags = orderedTags.filter(t => !isFeaturedTag(t))
  const renderTagChip = (tag) => {
    const featured = isFeaturedTag(tag)
    return (
      <button
        key={tag.id}
        className={`chip${activeTag?.id === tag.id ? ' chip-active' : ''}`}
        onClick={() => onChangeActiveTag(activeTag?.id === tag.id ? null : tag)}
      >
        {featured && <AppleIcon size={14} />}
        {tag.is_private && !featured && <LockIcon size={10} color="currentColor" />}
        {tag.name}
        <span className="chip-count">{tagCounts.get(tag.id) ?? 0}</span>
      </button>
    )
  }
  const scroll = (
    <div className="filter-scroll">
      {featuredTag && renderTagChip(featuredTag)}
      {showAll && (
        <button
          className={`chip${!activeTag ? ' chip-active' : ''}`}
          onClick={() => onChangeActiveTag(null)}
        >{S.common.all}<span className="chip-count">{totalCount}</span></button>
      )}
      {showUntagged && (
        <button
          className={`chip${isUntagged ? ' chip-active' : ''}`}
          onClick={() => onChangeActiveTag(isUntagged ? null : { id: '__untagged__' })}
        >{S.collection.untagged}<span className="chip-count">{untaggedCount}</span></button>
      )}
      {otherTags.map(renderTagChip)}
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
