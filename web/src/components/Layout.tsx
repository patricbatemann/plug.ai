import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">A</span>
          <span>AI Energy</span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>Home</NavLink>
          {user ? (
            <>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <button className="nav-button" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Sign in</NavLink>
              <Link className="button button-small" to="/register">Get started</Link>
            </>
          )}
        </nav>
      </header>
      <main><Outlet /></main>
      <footer>Built for a brighter, more thoughtful energy future.</footer>
    </div>
  )
}
