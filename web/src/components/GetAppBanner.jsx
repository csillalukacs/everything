import { useState } from 'react'
import { APP_TESTFLIGHT_URL } from '../../../shared/links'
import { S } from '../../../shared/strings'

const DISMISS_KEY = 'getAppBannerDismissed'

export default function GetAppBanner() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1' } catch { return false }
  })

  if (dismissed) return null

  function dismiss() {
    setDismissed(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  return (
    <div className="app-banner">
      <span className="app-banner-text">{S.webApp.bannerText}</span>
      <a
        className="app-banner-cta"
        href={APP_TESTFLIGHT_URL}
        target="_blank"
        rel="noopener noreferrer"
      >{S.webApp.bannerCta}</a>
      <button
        className="app-banner-close"
        onClick={dismiss}
        aria-label={S.webApp.dismiss}
      >✕</button>
    </div>
  )
}
