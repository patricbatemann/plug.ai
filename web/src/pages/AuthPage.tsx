import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Form, InlineNotification, PasswordInput, Stack, TextInput, Tile } from '@carbon/react'
import { useAuth } from '../auth/AuthContext'
import { PRODUCT_NAME } from '../format'

interface AuthPageProps {
  mode: 'login' | 'register'
}

export function AuthPage({ mode }: AuthPageProps) {
  const isRegister = mode === 'register'
  const { user, signIn, signUp } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const destination = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname

  if (user) return <Navigate to={destination || '/portfolio'} replace />

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (isRegister) await signUp(email, password)
      else await signIn(email, password)
      navigate(destination || '/portfolio', { replace: true })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-wrap">
      <Tile className="auth-card">
        <h1 className="page-title">{isRegister ? `Create your ${PRODUCT_NAME} account` : `Sign in to ${PRODUCT_NAME}`}</h1>
        <Form onSubmit={handleSubmit}>
          <Stack gap={6}>
            <TextInput
              id="email"
              type="email"
              labelText="Email address"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <PasswordInput
              id="password"
              labelText="Password"
              helperText={isRegister ? 'At least 8 characters' : undefined}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={isRegister ? 8 : 1}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            {error && <InlineNotification kind="error" title={error} hideCloseButton lowContrast />}
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </Button>
          </Stack>
        </Form>
        <p className="page-meta">
          {isRegister ? 'Already have an account? ' : 'New here? '}
          <Link className="cds--link" to={isRegister ? '/login' : '/register'}>
            {isRegister ? 'Sign in' : 'Create an account'}
          </Link>
        </p>
      </Tile>
    </div>
  )
}
