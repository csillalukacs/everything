import Avatar from '../components/Avatar'
import { S } from '../../../shared/strings'

// Opens when you click a profile picture (yours or someone else's). Home for
// follower/following counts + the follow / report / block actions.
export default function ProfileSheet({
  visible,
  onClose,
  profile,
  counts = { followers: 0, following: 0 },
  isOwn,
  isFollowing,
  isBlocked,
  onToggleFollow,
  onReport,
  onBlock,
  onUnblock,
  onShowFollows,
}) {
  if (!visible) return null
  const name = profile?.display_name || (profile?.username ? `@${profile.username}` : 'someone')

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal profile-sheet">
        <div className="modal-header">
          <span className="follow-list-header-spacer" />
          <button className="link-btn" onClick={onClose}>✕</button>
        </div>
        <div className="profile-sheet-head">
          <Avatar profile={profile ?? {}} size={64} />
          <div>
            <div className="profile-sheet-name">{name}</div>
            {profile?.username && profile?.display_name && (
              <div className="profile-sheet-handle">@{profile.username}</div>
            )}
          </div>
        </div>
        <div className="profile-sheet-counts">
          <button className="profile-sheet-count" onClick={() => onShowFollows('followers')}>
            <strong>{counts.followers}</strong> {S.social.followersTitle}
          </button>
          <button className="profile-sheet-count" onClick={() => onShowFollows('following')}>
            <strong>{counts.following}</strong> {S.social.followingTitle}
          </button>
        </div>
        {!isOwn && (
          isBlocked ? (
            <button className="btn-primary" onClick={onUnblock}>{S.moderation.unblock}</button>
          ) : (
            <>
              <button
                className={isFollowing ? 'btn-primary btn-outline' : 'btn-primary'}
                onClick={onToggleFollow}
              >{isFollowing ? S.social.following : S.social.follow}</button>
              <div className="profile-sheet-mod">
                <button className="link-btn" onClick={onReport}>{S.moderation.report}</button>
                <button className="link-btn link-btn-danger" onClick={onBlock}>{S.moderation.block}</button>
              </div>
            </>
          )
        )}
      </div>
    </div>
  )
}
