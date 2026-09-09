import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Card, PageHeader } from '../components/Card'
import { ChangePasswordForm } from '../features/profile/ChangePasswordForm'
import { EditProfileForm } from '../features/profile/EditProfileForm'

function initials(name: string | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <dt className="w-40 shrink-0 text-sm text-ink-500">{label}</dt>
      <dd className="text-sm text-ink-100">{value}</dd>
    </div>
  )
}

/**
 * One panel at a time. Both forms write to the session on success, so having them open
 * together invites saving one against a token the other just replaced.
 */
type OpenPanel = 'none' | 'details' | 'password'

export function ProfilePage() {
  const { user, isManager, signOut } = useAuth()
  const navigate = useNavigate()

  const [panel, setPanel] = useState<OpenPanel>('none')
  const [saved, setSaved] = useState<string | null>(null)

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  function close(message?: string) {
    setPanel('none')
    setSaved(message ?? null)
  }

  function open(next: OpenPanel) {
    // Clearing the confirmation on the way in: leaving "Your details have been updated"
    // above a form the user is now filling in reads as if it already succeeded.
    setSaved(null)
    setPanel(next)
  }

  return (
    <section className="animate-fade-up">
      <PageHeader title="Profile & settings" description="Your account details." />

      {saved && (
        <div className="mb-4">
          <Alert tone="success">{saved}</Alert>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-4 border-b border-white/5 bg-navy-700/30 px-4 py-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-500/20 text-lg font-semibold text-brand-200 ring-1 ring-brand-400/30">
            {initials(user?.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-ink-100">{user?.name}</p>
            <p className="truncate text-sm text-ink-300">{user?.email}</p>
          </div>
          {/* The edit affordance sits beside the identity it edits, not in the page header,
              so it is unambiguous which of the two panels below it opens. */}
          {panel !== 'details' && (
            <Button variant="secondary" onClick={() => open('details')}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
                className="size-4"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4 16.5V20Z"
                />
              </svg>
              Edit
            </Button>
          )}
        </div>

        {panel === 'details' ? (
          <EditProfileForm
            onDone={() => close('Your details have been updated.')}
            onCancel={() => close()}
          />
        ) : (
          <dl className="divide-y divide-white/5">
            <Row label="Name" value={user?.name ?? '—'} />
            <Row label="Email" value={user?.email ?? '—'} />
          </dl>
        )}

        {/* Role and permissions stay read-only in both states. Nobody may change their own
            role: the backend refuses it, because demoting yourself removes the access needed
            to undo it. A manager changes it from user management. */}
        <dl className="divide-y divide-white/5 border-t border-white/5">
          <Row label="Role" value={isManager ? 'Manager' : 'Team member'} />
          <Row
            label="Permissions"
            value={
              isManager
                ? 'File own reports, review the whole team, approve or request changes'
                : 'File, edit and submit your own weekly reports'
            }
          />
        </dl>

        {panel === 'password' ? (
          <div className="border-t border-white/5">
            <ChangePasswordForm
              onDone={() => close('Your password has been changed.')}
              onCancel={() => close()}
            />
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-4 py-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink-100">Password</p>
              <p className="mt-0.5 text-xs text-ink-500">
                You&apos;ll need your current password to set a new one.
              </p>
            </div>
            <Button variant="secondary" onClick={() => open('password')}>
              Change password
            </Button>
          </div>
        )}

        <div className="border-t border-white/5 px-4 py-4">
          <Button variant="secondary" onClick={handleSignOut}>
            Sign out
          </Button>
          <p className="mt-3 text-xs text-ink-500">
            Changing your password does not end sessions on your other devices — tokens are
            stateless and stay valid until they expire.
            {!isManager && ' Your role and access are set by a manager.'}
          </p>
          {isManager && (
            <Link
              to="/admin/users"
              className="mt-2 inline-block text-xs font-medium text-brand-300 transition hover:text-brand-200"
            >
              Go to user management →
            </Link>
          )}
        </div>
      </Card>
    </section>
  )
}
