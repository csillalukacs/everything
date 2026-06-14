import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { S } from '../../../shared/strings'

export default function AuthScreen() {
  const navigate = useNavigate()

  // A rejected signup (e.g. email not on the allowlist) bounces back from
  // Google with an error in the URL hash. Send it to the dedicated error page.
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (!hash) return
    const params = new URLSearchParams(hash)
    if (params.get('error')) {
      window.history.replaceState(null, '', window.location.pathname)
      navigate('/login-error', { replace: true })
    }
  }, [navigate])

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  async function signInWithApple() {
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
    </div>
  )
}
