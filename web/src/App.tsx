import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ActionsPage } from './pages/ActionsPage'
import { AuthPage } from './pages/AuthPage'
import { DecisionPage } from './pages/DecisionPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SitePage } from './pages/SitePage'
import { RequireAuth } from './auth/RequireAuth'

export function App() {
  return (
    <Routes>
      <Route path="login" element={<AuthPage mode="login" />} />
      <Route path="register" element={<AuthPage mode="register" />} />
      <Route element={<RequireAuth />}>
        <Route element={<Layout />}>
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="sites/:code" element={<SitePage />} />
          <Route path="decisions/:id" element={<DecisionPage />} />
          <Route path="actions" element={<ActionsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/portfolio" replace />} />
    </Routes>
  )
}
