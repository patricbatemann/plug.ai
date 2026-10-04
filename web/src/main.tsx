import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError, tokenStore } from './api/client'
import { AuthProvider } from './auth/AuthContext'
import { App } from './App'
import '@carbon/charts-react/styles.css'
import './styles/app.scss'

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      // An expired session: start again from the sign-in page.
      if (error instanceof ApiError && error.status === 401) {
        tokenStore.clear()
        window.location.assign('/login')
      }
    },
  }),
  defaultOptions: { queries: { retry: false } },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
