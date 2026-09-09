import { useState } from 'react'
import { ApiError } from '../../api/client'
import { updateProfile } from '../../api/profile'
import { useAuth } from '../../auth/useAuth'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'

/** Mirrors the backend's own constraints, so a typo is caught before a round trip. */
const NAME_PATTERN = /^[A-Za-z]+( [A-Za-z]+)*$/

function validate(name: string, email: string): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!name.trim()) errors.name = 'Name is required'
  else if (!NAME_PATTERN.test(name.trim())) errors.name = 'Name must contain only letters and spaces'

  if (!email.trim()) errors.email = 'Email is required'
  else if (!email.includes('@')) errors.email = 'Email must be valid'

  return errors
}

/**
 * Editing your own name and email.
 *
 * <p>Role is not here on purpose. Nobody may change their own role — the backend refuses it
 * with SelfAdministrationException, since demoting yourself removes the access needed to undo
 * it — so following this app's rule that the UI doesn't offer what the backend refuses, the
 * field is absent rather than present and rejected.
 */
export function EditProfileForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { user, signIn } = useAuth()

  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const clientErrors = validate(name, email)
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    setSaving(true)
    try {
      const response = await updateProfile({ name: name.trim(), email: email.trim() })
      // signIn, not a local state update: the response carries a newly signed token, and the
      // old one names the user by their previous email. Storing it is what keeps the session
      // alive across an email change.
      signIn(response)
      onDone()
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors)
        setError(Object.keys(caught.fieldErrors).length > 0 ? null : caught.message)
      } else {
        setError('Could not save your details.')
      }
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className={`space-y-4 px-4 py-4 transition-opacity duration-200 ${saving ? 'pointer-events-none opacity-60' : ''}`}
    >
      {error && <Alert>{error}</Alert>}

      <TextField
        label="Full name"
        name="name"
        id="profile-name"
        autoComplete="name"
        required
        value={name}
        error={fieldErrors.name}
        onChange={(event) => setName(event.target.value)}
      />
      <TextField
        label="Email"
        name="email"
        id="profile-email"
        type="email"
        autoComplete="email"
        required
        value={email}
        error={fieldErrors.email}
        hint="This is also the address you sign in with."
        onChange={(event) => setEmail(event.target.value)}
      />

      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" loading={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
