import { supabase } from '../lib/supabase'
import { S } from '../../../shared/strings'

export default function AuthScreen() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
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
    </div>
  )
}
