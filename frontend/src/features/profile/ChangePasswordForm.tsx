import { useState } from 'react'
import { ApiError } from '../../api/client'
import { changePassword } from '../../api/profile'
import { useAuth } from '../../auth/useAuth'
import { Alert } from '../../components/Alert'
import { Button } from '../../components/Button'
import { TextField } from '../../components/TextField'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/

function validate(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string,
): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!currentPassword) errors.currentPassword = 'Current password is required'

  if (newPassword.length < 8) errors.newPassword = 'Password must be at least 8 characters'
  else if (!PASSWORD_PATTERN.test(newPassword))
    errors.newPassword =
      'Add an uppercase letter, a lowercase letter, a number and a special character'
  else if (newPassword === currentPassword)
    errors.newPassword = 'The new password must be different from the current one'

  // Confirmation is checked here only. The backend has no second field to compare against,
  // and asking it to would mean sending the password twice for no gain.
  if (confirmPassword !== newPassword) errors.confirmPassword = 'The two passwords do not match'

  return errors
}

/**
 * Changing your own password.
 *
 * <p>The current password is asked for even though the user is already signed in: a bearer
 * token proves a session exists, not that the person holding it knows the password. Without
 * it, a borrowed token could lock the real owner out for good.
 */
export function ChangePasswordForm({
  onDone,
  onCancel,
}: {
  onDone: () => void
  onCancel: () => void
}) {
  const { signIn } = useAuth()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    const clientErrors = validate(currentPassword, newPassword, confirmPassword)
    setFieldErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    setSaving(true)
    try {
      const response = await changePassword({ currentPassword, newPassword })
      // The returned token is fresh; storing it keeps the session's expiry in step with the
      // change rather than leaving the user on one issued before it.
      signIn(response)
      onDone()
    } catch (caught) {
      if (caught instanceof ApiError) {
        // A wrong current password comes back as a 400 with a message and no fieldErrors, so
        // it lands in the banner. Deliberately not a 401 on the backend - that would have
        // signed the user out mid-form.
        setFieldErrors(caught.fieldErrors)
        setError(Object.keys(caught.fieldErrors).length > 0 ? null : caught.message)
      } else {
        setError('Could not change your password.')
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
        label="Current password"
        name="currentPassword"
        id="profile-current-password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••"
        required
        value={currentPassword}
        error={fieldErrors.currentPassword}
        onChange={(event) => setCurrentPassword(event.target.value)}
      />
      <TextField
        label="New password"
        name="newPassword"
        id="profile-new-password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        value={newPassword}
        error={fieldErrors.newPassword}
        hint="8+ characters, with upper and lower case, a number and a symbol."
        onChange={(event) => setNewPassword(event.target.value)}
      />
      <TextField
        label="Confirm new password"
        name="confirmPassword"
        id="profile-confirm-password"
        type="password"
        autoComplete="new-password"
        placeholder="••••••••"
        required
        value={confirmPassword}
        error={fieldErrors.confirmPassword}
        onChange={(event) => setConfirmPassword(event.target.value)}
      />

      <div className="flex flex-wrap gap-2.5">
        <Button type="submit" loading={saving}>
          {saving ? 'Updating…' : 'Update password'}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
