import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function HomePage() {
  const { user } = useAuth()
  return (
    <section className="hero">
      <div className="eyebrow"><span className="pulse-dot" /> YOUR ENERGY, IN FOCUS</div>
      <h1>A smarter starting point for a <span>brighter future.</span></h1>
      <p className="hero-copy">
        A clean foundation for building thoughtful energy experiences. Sign in to explore your
        private workspace, or create an account to get started.
      </p>
      <div className="hero-actions">
        <Link className="button" to={user ? '/dashboard' : '/register'}>
          {user ? 'Open your dashboard' : 'Create your account'} <span aria-hidden="true">→</span>
        </Link>
        {!user && <Link className="text-link" to="/login">I already have an account</Link>}
      </div>
      <div className="hero-note">
        <span className="note-icon">✳</span>
        <span><strong>A fresh foundation.</strong> Ready for your next idea.</span>
      </div>
    </section>
  )
}
