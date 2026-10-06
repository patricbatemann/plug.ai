import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { InlineNotification, OverflowMenu, OverflowMenuItem } from '@carbon/react'
import { useAuth } from '../auth/AuthContext'
import { AskBobProvider } from '../runs/AskBob'
import { EventToasts } from '../runs/EventToasts'
import { RunControl } from '../runs/RunControl'
import { useOpenActions } from '../runs/useActions'
import { useCurrentRun } from '../runs/useCurrentRun'
import { SettingsModal } from './SettingsModal'

export function Layout() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const { data: run } = useCurrentRun()
  const pending = useOpenActions(run).data?.length ?? 0
  const [settings, setSettings] = useState(false)
  const initials = (user?.email ?? '?').slice(0, 2).toUpperCase()

  return (
    <AskBobProvider>
      <header className="topnav">
        <nav aria-label="Main navigation" className="topnav__links">
          <NavLink to="/portfolio" className={({ isActive }) => navClass(isActive || pathname.startsWith('/sites'))}>
            Portfolio
          </NavLink>
          <NavLink to="/actions" className={({ isActive }) => navClass(isActive)}>
            Actions{pending > 0 && ` (${pending})`}
          </NavLink>
          <NavLink to="/simulation" className={({ isActive }) => navClass(isActive)}>Simulation</NavLink>
          <NavLink to="/assistant" className={({ isActive }) => navClass(isActive)}>Ask BOB</NavLink>
        </nav>
        <div className="topnav__right">
          <RunControl />
          <OverflowMenu
            aria-label={`Account ${user?.email ?? ''}`}
            className="avatar"
            flipped
            renderIcon={() => <span>{initials}</span>}
          >
            <OverflowMenuItem itemText="Settings" onClick={() => setSettings(true)} />
            <OverflowMenuItem itemText="Sign out" onClick={signOut} />
          </OverflowMenu>
        </div>
      </header>
      <EventToasts />
      <SettingsModal open={settings} onClose={() => setSettings(false)} />
      <main className="page">
        {run?.lagging && (
          <InlineNotification kind="warning" lowContrast hideCloseButton className="page-banner"
            title="The simulation clock is behind" subtitle="No worker is advancing the run: start one with make worker." />
        )}
        <Outlet />
      </main>
    </AskBobProvider>
  )
}

const navClass = (active: boolean) => `topnav__link${active ? ' topnav__link--active' : ''}`
