import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { Card, PageHeader } from '../components/Card'

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

export function ProfilePage() {
  const { user, isManager, signOut } = useAuth()
  const navigate = useNavigate()

  function handleSignOut() {
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <section className="animate-fade-up">
      <PageHeader title="Profile & settings" description="Your account details." />

      <Card>
        <div className="flex items-center gap-4 border-b border-white/5 bg-navy-700/30 px-4 py-5">
          <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-500/20 text-lg font-semibold text-brand-200 ring-1 ring-brand-400/30">
            {initials(user?.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-ink-100">{user?.name}</p>
            <p className="truncate text-sm text-ink-300">{user?.email}</p>
          </div>
        </div>

        <dl className="divide-y divide-white/5">
          <Row label="Name" value={user?.name ?? '—'} />
          <Row label="Email" value={user?.email ?? '—'} />
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

        <div className="border-t border-white/5 px-4 py-4">
          <Button variant="secondary" onClick={handleSignOut}>
            Sign out
          </Button>
          {/* Editing a profile and changing a password need backend endpoints that do not
              exist yet - see docs/PLAN.md Phase 3. */}
          <p className="mt-3 text-xs text-ink-500">
            Editing your details and changing your password arrive with the account
            management endpoints.
          </p>
        </div>
      </Card>
    </section>
  )
}
