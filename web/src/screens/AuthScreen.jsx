import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { S } from '../../../shared/strings'

export default function AuthScreen() {
  const [searchParams] = useSearchParams()
  // Stash where the visitor came from before the OAuth round-trip. We can't put
  // it on redirectTo — Supabase only allows redirecting to allow-listed URLs, so
  // a query param there makes it fall back to the Site URL. localStorage survives
  // the round-trip (same origin) and App reads it once the session lands.
  function rememberRedirect() {
    const redirect = searchParams.get('redirect')
    if (redirect) localStorage.setItem('postLoginRedirect', redirect)
  }

  async function signInWithGoogle() {
    rememberRedirect()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signInWithApple() {
    rememberRedirect()
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="auth">
      <h1 className="title">{S.appName}</h1>
      <p className="subtitle">{S.appTagline}</p>
      <button className="btn-primary" onClick={signInWithGoogle}>
        {S.auth.continueWithGoogle}
      </button>
      <button className="btn-primary btn-apple" onClick={signInWithApple}>
        {S.auth.continueWithApple}
      </button>
      <p className="auth-terms">
        {S.auth.agreePrefix}
        <Link to="/terms" className="auth-terms-link">{S.legal.termsLink}</Link>
        {S.auth.agreeSuffix}
      </p>
    </div>
  )
}
