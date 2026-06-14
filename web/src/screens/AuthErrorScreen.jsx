import { Link } from 'react-router-dom'
import { S } from '../../../shared/strings'

export default function AuthErrorScreen() {
  return (
    <div className="auth">
      <h1 className="title">{S.appName}</h1>
      <p className="auth-error">{S.auth.notAllowed}</p>
      <Link to="/" className="btn-primary">{S.auth.backToLogin}</Link>
    </div>
  )
}
