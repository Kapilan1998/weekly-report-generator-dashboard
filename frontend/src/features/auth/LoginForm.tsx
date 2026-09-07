import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { login } from '../../api/auth'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { useAuth } from '../../auth/useAuth'

interface RedirectState {
  from?: { pathname?: string }
}

export function LoginForm() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await login({ email: email.trim(), password })
      signIn(response)
      // Return them to whatever ProtectedRoute bounced them away from.
      const target = (location.state as RedirectState | null)?.from?.pathname ?? '/reports'
      navigate(target, { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in.')
      setSubmitting(false)
    }
    // On success the route changes, so submitting stays true and the button keeps its
    // spinner until this screen goes away - no flicker back to "Sign in".
  }

  return (
    <div className="animate-fade-up rounded-2xl bg-navy-800 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 [animation-delay:120ms] sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-ink-100">Welcome back</h1>
      <p className="mt-1 text-sm text-ink-300">Sign in to file and review weekly reports.</p>

      <form
        onSubmit={handleSubmit}
        noValidate
        // Dims and blocks the form while the request is in flight.
        className={`mt-6 space-y-4 transition-opacity duration-200 ${submitting ? 'pointer-events-none opacity-60' : ''}`}
      >
        {error && <Alert>{error}</Alert>}

        <TextField
          label="Email"
          name="email"
          id="login-email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Password"
          name="password"
          id="login-password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-300">
        No account yet?{' '}
        <Link
          to="/register"
          className="font-semibold text-brand-300 underline-offset-4 transition hover:text-brand-200 hover:underline"
        >
          Create one
        </Link>
      </p>
    </div>
  )
}
