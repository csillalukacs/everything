import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import LockIcon from './LockIcon'
import { S } from '../../../shared/strings'

export default function CollagesStrip({ userId }) {
  const [collages, setCollages] = useState([])
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    supabase
      .from('collages')
      .select('id, title, cover_url, cover_thumb_url, is_private, updated_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) { console.error('fetch collages error:', error); return }
        setCollages((data ?? []).filter(c => c.cover_url || c.cover_thumb_url))
      })
    return () => { cancelled = true }
  }, [userId])

  useEffect(() => {
    if (!viewing) return
    function onKey(e) { if (e.key === 'Escape') setViewing(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing])

  if (collages.length === 0) return null

  return (
    <section className="collages-strip">
      <h2 className="collages-strip-title">{S.collages.title}</h2>
      <div className="collages-strip-row">
        {collages.map(c => (
          <button
            key={c.id}
            type="button"
            className="collages-strip-tile"
            onClick={() => setViewing(c)}
            title={c.title || S.collages.untitled}
          >
            <img
              src={c.cover_thumb_url || c.cover_url}
              alt={c.title || ''}
              loading="lazy"
            />
            {c.is_private && (
              <div className="collages-strip-lock"><LockIcon size={10} color="#fff" /></div>
            )}
          </button>
        ))}
      </div>

      {viewing && (
        <div className="sheet-overlay" onClick={() => setViewing(null)} role="dialog">
          <div className="collage-viewer" onClick={e => e.stopPropagation()}>
            <img src={viewing.cover_url || viewing.cover_thumb_url} alt={viewing.title || ''} />
            {viewing.title && <p className="collage-viewer-title">{viewing.title}</p>}
          </div>
        </div>
      )}
    </section>
  )
}
