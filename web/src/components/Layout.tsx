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

export function Layout() {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()

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
        </HeaderNavigation>
        <HeaderGlobalBar>
          <HeaderGlobalAction aria-label={`Sign out ${user?.email ?? ''}`} onClick={signOut}>
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>
      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
