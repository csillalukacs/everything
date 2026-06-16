import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { S } from '../../../shared/strings'

export default function AuthScreen() {
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
      <p className="auth-terms">
        {S.auth.agreePrefix}
        <Link to="/terms" className="auth-terms-link">{S.legal.termsLink}</Link>
        {S.auth.agreeSuffix}
      </p>
    </div>
  )
}
