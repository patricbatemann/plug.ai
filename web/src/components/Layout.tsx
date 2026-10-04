import { Link, Outlet, useLocation } from 'react-router-dom'
import {
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuItem,
  HeaderName,
  HeaderNavigation,
} from '@carbon/react'
import { Logout } from '@carbon/icons-react'
import { useAuth } from '../auth/AuthContext'
import { PRODUCT_NAME } from '../format'
import { EventToasts } from '../runs/EventToasts'
import { RunControl } from '../runs/RunControl'
import { useOpenActions } from '../runs/useActions'
import { useCurrentRun } from '../runs/useCurrentRun'

export function Layout() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const { data: run } = useCurrentRun()
  const pending = useOpenActions(run).data?.length ?? 0

  return (
    <>
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
        </HeaderNavigation>
        <HeaderGlobalBar>
          <RunControl />
          <HeaderGlobalAction aria-label={`Sign out ${user?.email ?? ''}`} onClick={signOut}>
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      <EventToasts />
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
