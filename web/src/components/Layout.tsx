import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Header,
  InlineNotification,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
} from '@carbon/react'
import { Chat, Logout, Settings } from '@carbon/icons-react'
import { useAuth } from '../auth/AuthContext'
import { PRODUCT_NAME } from '../format'
import { AskBobProvider, useAskBob } from '../runs/AskBob'
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

  return (
    <AskBobProvider>
      <Header aria-label={PRODUCT_NAME}>
        <HeaderName as={Link} to="/portfolio" prefix="">
          {PRODUCT_NAME}
        </HeaderName>
        <HeaderNavigation aria-label="Main navigation">
          <HeaderMenuItem
            as={Link}
            to="/portfolio"
            isActive={pathname.startsWith('/portfolio') || pathname.startsWith('/sites')}
          >
            Portfolio
          </HeaderMenuItem>
          <HeaderMenuItem as={Link} to="/actions" isActive={pathname.startsWith('/actions')}>
            Actions{pending > 0 && ` (${pending})`}
          </HeaderMenuItem>
          <HeaderMenuItem as={Link} to="/simulation" isActive={pathname.startsWith('/simulation')}>
            Simulation
          </HeaderMenuItem>
          <HeaderMenuItem as={Link} to="/assistant" isActive={pathname.startsWith('/assistant')}>
            Assistant
          </HeaderMenuItem>
        </HeaderNavigation>
        <HeaderGlobalBar>
          <RunControl />
          <AskBobButton />
          <HeaderGlobalAction aria-label="Settings" tooltipAlignment="end" onClick={() => setSettings(true)}>
            <Settings size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction aria-label={`Sign out ${user?.email ?? ''}`} onClick={signOut}>
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
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

function AskBobButton() {
  const ask = useAskBob()
  return (
    <HeaderGlobalAction aria-label="Ask BOB" tooltipAlignment="end" onClick={() => ask()}>
      <Chat size={20} />
    </HeaderGlobalAction>
  )
}
