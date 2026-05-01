import { supabase } from '../lib/supabase'

export default function AuthScreen() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  return (
    <div className="auth">
      <h1 className="title">things</h1>
      <p className="subtitle">a home for your stuff</p>
      <button className="btn-primary" onClick={signInWithGoogle}>
        continue with google
      </button>
    </div>
  )
}
