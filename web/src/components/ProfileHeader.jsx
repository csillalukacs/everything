import { Link } from 'react-router-dom'
import Avatar from './Avatar'
import { S } from '../../../shared/strings'

export default function ProfileHeader({
  slug,
  userId,
  profileName,
  username,
  avatarUrl,
  avatarThumbUrl,
  home,
  itemCount,
  isOwner,
  isBlocked,
  isFollowing,
  followCounts,
  onShowFollowers,
  onShowFollowing,
  onReport,
  onBlock,
  onUnblock,
  onToggleFollow,
}) {
  const displayName = profileName ?? username ?? userId?.split('-')[0] ?? ''
  return (
    <header className="header">
      <div className="profile-header-row">
        <Avatar
          profile={{
            user_id: userId,
            display_name: profileName,
            username,
            avatar_url: avatarUrl,
            avatar_thumb_url: avatarThumbUrl,
          }}
          size={64}
        />
        <div>
          <div className="profile-name-row">
            <h1 className="profile-name">
              {displayName}
              {itemCount != null && !isBlocked && (
                <>
                  {' · '}
                  <Link to={`/u/${slug}`} className="profile-count-link">
                    {S.profile.objectCount(itemCount)}
                  </Link>
                </>
              )}
            </h1>
          </div>
          {username && <p className="profile-username-readonly">@{username}</p>}
          {home?.location && (
            <p className="profile-home-readonly">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {home.location.split(',')[0]}
            </p>
          )}
          {followCounts && !isBlocked && (
            <p className="profile-follow-counts">
              <button className="follow-count-btn" onClick={onShowFollowers}>
                {S.social.followersCount(followCounts.followers)}
              </button>
              {' · '}
              <button className="follow-count-btn" onClick={onShowFollowing}>
                {S.social.followingCount(followCounts.following)}
              </button>
            </p>
          )}
        </div>
      </div>
      <div className="header-links" style={{ marginTop: 8 }}>
        {isOwner && <Link to="/settings" className="link-btn">{S.profile.settings}</Link>}
        {isOwner && <Link to="/stats" className="link-btn">{S.stats.title}</Link>}
        <Link to="/" className="link-btn">{S.a11y.feed}</Link>
        {!isOwner && !isBlocked && onToggleFollow && (
          <button
            className={`link-btn${isFollowing ? '' : ' link-btn-dark'}`}
            onClick={onToggleFollow}
          >{isFollowing ? S.social.following : S.social.follow}</button>
        )}
        {!isOwner && isBlocked && onUnblock && <button className="link-btn" onClick={onUnblock}>{S.moderation.unblock}</button>}
        {!isOwner && !isBlocked && onReport && <button className="link-btn" onClick={onReport}>{S.moderation.report}</button>}
        {!isOwner && !isBlocked && onBlock && <button className="link-btn" onClick={onBlock}>{S.moderation.block}</button>}
      </div>
    </header>
  )
}
