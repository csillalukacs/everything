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
  collageCount,
  isOwner,
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
              {itemCount != null && (
                <>
                  {' · '}
                  <Link to={`/u/${slug}`} className="profile-count-link">
                    {S.profile.objectCount(itemCount)}
                  </Link>
                </>
              )}
              {collageCount > 0 && (
                <>
                  {' · '}
                  <Link to={`/u/${slug}/collages`} className="profile-count-link">
                    {S.profile.collageCount(collageCount)}
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
        </div>
      </div>
      <div className="header-links" style={{ marginTop: 8 }}>
        {isOwner && <Link to="/settings" className="link-btn">{S.profile.settings}</Link>}
        {isOwner && <Link to="/stats" className="link-btn">{S.stats.title}</Link>}
        <Link to="/" className="link-btn">{S.appName}</Link>
      </div>
    </header>
  )
}
