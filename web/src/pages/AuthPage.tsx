import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button, Form, InlineNotification, PasswordInput, Stack, TextInput } from '@carbon/react'
import { ArrowRight, Locked } from '@carbon/icons-react'
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
    <div className="auth">
      <header className="auth__bar">
        <span className="auth__brand"><strong>{PRODUCT_NAME}</strong><span className="band__rule" />Energy operations platform</span>
        <span className="auth__secure"><Locked size={14} />Secure access</span>
      </header>
      <main className="auth__main">
        <div className="panel auth__card">
          <span className="badge badge--blue auth__badge">Operator access</span>
          <h1 className="auth__title">{isRegister ? 'Create your account' : 'Sign in'}</h1>
          <p className="rec__text">
            {isRegister ? `Create an operator account for the ${PRODUCT_NAME} energy operations platform.`
              : `Secure access to the ${PRODUCT_NAME} energy operations platform.`}
          </p>
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
              <Button type="submit" className="auth__submit" renderIcon={ArrowRight} disabled={submitting}>
                {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
              </Button>
            </Stack>
          </Form>
          <div className="auth__foot">
            <span><Locked size={12} /> For authorised operators only.</span>
            <span>
              {isRegister ? 'Already have an account? ' : 'New here? '}
              <Link className="text-link" to={isRegister ? '/login' : '/register'}>
                {isRegister ? 'Sign in' : 'Create an account'}
              </Link>
            </span>
          </div>
        </div>
      </main>
      <footer className="auth__footer">© {new Date().getFullYear()} {PRODUCT_NAME}</footer>
    </div>
  )
}
