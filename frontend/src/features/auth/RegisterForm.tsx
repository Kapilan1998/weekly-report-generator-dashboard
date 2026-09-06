import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../api/auth'
import { ApiError } from '../../api/client'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'
import { useAuth } from '../../auth/useAuth'

const NAME_PATTERN = /^[A-Za-z]+( [A-Za-z]+)*$/
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

/** Mirrors the backend's own constraints so the user gets told before a round trip. */
function validate(name: string, email: string, password: string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!name.trim()) errors.name = 'Name is required'
  else if (!NAME_PATTERN.test(name.trim())) errors.name = 'Name must contain only letters and spaces'

  if (!email.trim()) errors.email = 'Email is required'
  else if (!email.includes('@')) errors.email = 'Email must be valid'

  if (password.length < 8) errors.password = 'Password must be at least 8 characters'
  else if (!PASSWORD_PATTERN.test(password))
    errors.password =
      'Add an uppercase letter, a lowercase letter, a number and a special character'

  return errors
}

export function RegisterForm() {
  const { signIn } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const clientErrors = validate(name, email, password)
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    setSubmitting(true)
    try {
      const response = await register({ name: name.trim(), email: email.trim(), password })
      signIn(response)
      navigate('/reports', { replace: true })
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors)
        setError(Object.keys(caught.fieldErrors).length > 0 ? null : caught.message)
      } else {
        setError('Could not create the account.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="animate-fade-up rounded-2xl bg-navy-800 p-6 shadow-2xl shadow-black/30 ring-1 ring-white/5 [animation-delay:120ms] sm:p-8">
      <h1 className="text-xl font-semibold tracking-tight text-ink-100">Create your account</h1>
      <p className="mt-1 text-sm text-ink-300">
        New accounts join as team members. Manager access is granted by an administrator.
      </p>

      <form
        onSubmit={handleSubmit}
        noValidate
        className={`mt-6 space-y-4 transition-opacity duration-200 ${submitting ? 'pointer-events-none opacity-60' : ''}`}
      >
        {error && <Alert>{error}</Alert>}

        <TextField
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Alex Morgan"
          required
          value={name}
          error={fieldErrors.name}
          onChange={(event) => setName(event.target.value)}
        />
        <TextField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          required
          value={email}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="••••••••"
          required
          value={password}
          error={fieldErrors.password}
          hint="8+ characters, with upper and lower case, a number and a symbol."
          onChange={(event) => setPassword(event.target.value)}
        />

        <Button type="submit" loading={submitting} className="w-full">
          {submitting ? 'Creating account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-300">
        Already registered?{' '}
        <Link
          to="/login"
          className="font-semibold text-brand-300 underline-offset-4 transition hover:text-brand-200 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
