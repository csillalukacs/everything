import { Link } from 'react-router-dom'
import { S } from '../../../shared/strings'

export default function TermsPage() {
  return (
    <div className="app">
      <header className="header">
        <h1 className="title">{S.legal.termsTitle}</h1>
        <div className="header-links" style={{ marginTop: 8 }}>
          <Link to="/" className="link-btn">{S.appName}</Link>
        </div>
      </header>
      <div className="terms-body">
        {S.legal.body.map((para, i) => (
          <p key={i} className="terms-para">{para}</p>
        ))}
      </div>
    </div>
  )
}
