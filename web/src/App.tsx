import { Navigate, Route, Routes, useSearchParams } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ActionsPage } from './pages/ActionsPage'
import { AssistantPage } from './pages/AssistantPage'
import { AuthPage } from './pages/AuthPage'
import { ConfigureBobPage } from './pages/ConfigureBobPage'
import { DecisionPage } from './pages/DecisionPage'
import { PortfolioPage } from './pages/PortfolioPage'
import { SetupWizardPage } from './pages/SetupWizardPage'
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
          <Route path="sites/:code/bob" element={<ConfigureBobPage />} />
          <Route path="sites/:code/bob/setup" element={<SetupWizardRoute />} />
          <Route path="decisions/:id" element={<DecisionPage />} />
          <Route path="actions" element={<ActionsPage />} />
          <Route path="assistant" element={<AssistantPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/portfolio" replace />} />
    </Routes>
  )
}

/** A link from chat to a different draft starts the wizard afresh. */
function SetupWizardRoute() {
  const [params] = useSearchParams()
  return <SetupWizardPage key={params.toString()} />
}
