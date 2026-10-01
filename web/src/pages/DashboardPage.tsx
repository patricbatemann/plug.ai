import { useAuth } from '../auth/AuthContext'

export function DashboardPage() {
  const { user } = useAuth()
  return (
    <section className="dashboard">
      <p className="eyebrow"><span className="pulse-dot" /> PRIVATE WORKSPACE</p>
      <h1>Welcome in, <span>{user?.email.split('@')[0]}.</span></h1>
      <p className="hero-copy">
        Your account is connected and your workspace is ready. This is a clean place to build
        the product experience that comes next.
      </p>
      <div className="status-card">
        <div className="status-symbol">✓</div>
        <div><strong>You’re all set</strong><p>Your account is active and securely signed in.</p></div>
      </div>
    </section>
  )
}
