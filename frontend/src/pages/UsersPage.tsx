import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, errorMessage } from '../api/client'
import { createUser, deleteUser, listUsers, updateUser } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { SelectField } from '../components/SelectField'
import { TextField } from '../components/TextField'
import { formatDate } from '../lib/format'
import type { Role, UserDetail } from '../types/api'

interface NewUserForm {
  name: string
  email: string
  password: string
  role: Role
}

const BLANK: NewUserForm = { name: '', email: '', password: '', role: 'TEAM_MEMBER' }

const ROLE_LABELS: Record<Role, string> = {
  TEAM_MEMBER: 'Team member',
  MANAGER: 'Manager',
}

/**
 * User administration — add an account, assign a role, disable or delete one.
 *
 * Three of the backend's rules shape what this page offers rather than being left to fail on
 * submit, because each of them is about a change that can't be undone from the UI afterwards:
 *
 * - **Your own row has no role select and no disable button.** Demoting or disabling yourself
 *   would remove the access needed to reverse it, so the backend refuses; showing the control
 *   anyway would just be a trap.
 * - **Delete appears only when an account has no reports.** Report authorship is part of the
 *   audit trail and the foreign key has no cascade, so a member who has ever filed can only
 *   be disabled.
 * - **The last enabled manager can't be demoted or disabled** — with nobody left to review,
 *   no report could be approved and no access restored. That one can't be predicted from a
 *   single row, so it surfaces as the backend's message.
 *
 * Disabling takes effect immediately, not at token expiry: the JWT filter checks the flag on
 * every request, so an open session stops working on the next call.
 */
export function UsersPage() {
  const { user: currentUser } = useAuth()

  const [users, setUsers] = useState<UserDetail[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<NewUserForm>(BLANK)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [busyId, setBusyId] = useState<number | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    listUsers()
      .then((result) => {
        if (active) setUsers(result)
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(errorMessage(caught, 'Could not load accounts.'))
          setUsers([])
        }
      })
    return () => {
      active = false
    }
  }, [])

  /** Mirrors the backend's bean validation, so the obvious mistakes don't need a round trip. */
  function validate(input: NewUserForm): Record<string, string> {
    const errors: Record<string, string> = {}
    if (input.name.trim() === '') errors.name = 'Name is required'
    else if (!/^[A-Za-z]+( [A-Za-z]+)*$/.test(input.name.trim()))
      errors.name = 'Name must contain only letters and spaces'

    if (input.email.trim() === '') errors.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()))
      errors.email = 'Email must be valid'

    if (input.password.length < 8) errors.password = 'Password must be at least 8 characters'
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(input.password))
      errors.password =
        'Needs an uppercase letter, a lowercase letter, a number and a special character'

    return errors
  }

  async function handleCreate() {
    const errors = validate(form)
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const created = await createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      })
      setUsers((current) => sorted([...(current ?? []), created]))
      setNotice(
        `Added ${created.name}. Pass the initial password on — there is no invitation email.`,
      )
      setForm(BLANK)
      setFieldErrors({})
      setCreating(false)
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(
          Object.keys(caught.fieldErrors).length > 0
            ? caught.fieldErrors
            : // A taken email comes back as a 409 with no field errors.
              { email: caught.message },
        )
      } else {
        setError('Could not create the account.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function save(target: UserDetail, changes: { role?: Role; enabled?: boolean }) {
    setBusyId(target.id)
    setError(null)
    setNotice(null)
    try {
      // Both fields are required by the endpoint, so the unchanged one is sent as it is.
      const updated = await updateUser(target.id, {
        role: changes.role ?? target.role,
        enabled: changes.enabled ?? target.enabled,
      })
      setUsers((current) =>
        sorted((current ?? []).map((entry) => (entry.id === updated.id ? updated : entry))),
      )
      setNotice(
        changes.enabled === false
          ? `${updated.name} can no longer sign in, and any open session stops working now.`
          : changes.enabled === true
            ? `${updated.name} can sign in again.`
            : `${updated.name} is now a ${ROLE_LABELS[updated.role].toLowerCase()}.`,
      )
    } catch (caught) {
      setError(errorMessage(caught, 'Could not update the account.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(target: UserDetail) {
    setBusyId(target.id)
    setError(null)
    setNotice(null)
    try {
      await deleteUser(target.id)
      setUsers((current) => (current ?? []).filter((entry) => entry.id !== target.id))
      setNotice(`Deleted ${target.name}.`)
    } catch (caught) {
      setError(errorMessage(caught, 'Could not delete the account.'))
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  return (
    <section className="animate-fade-up space-y-4">
      <PageHeader
        title="User management"
        description="Accounts, roles and access."
        actions={!creating && <Button onClick={() => setCreating(true)}>+ Add team member</Button>}
      />

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {creating && (
        <Card>
          <h2 className="border-b border-white/5 bg-navy-700/30 px-4 py-3 text-sm font-semibold text-ink-100">
            New account
          </h2>
          {/* A real form, not a div: a password field outside one is ignored by password
              managers (and Chrome logs a warning about it), and Enter wouldn't submit. */}
          <form
            className="grid gap-4 p-4 sm:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault()
              void handleCreate()
            }}
          >
            <TextField
              label="Name"
              name="new-user-name"
              autoComplete="off"
              value={form.name}
              error={fieldErrors.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
            <TextField
              label="Email"
              name="new-user-email"
              type="email"
              autoComplete="off"
              value={form.email}
              error={fieldErrors.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <TextField
              label="Initial password"
              name="new-user-password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              error={fieldErrors.password}
              hint="At least 8 characters with upper, lower, a number and a symbol."
              onChange={(event) => setForm({ ...form, password: event.target.value })}
            />
            <SelectField
              label="Role"
              name="new-user-role"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
            >
              <option value="TEAM_MEMBER">Team member</option>
              <option value="MANAGER">Manager</option>
            </SelectField>

            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <Button type="submit" loading={saving}>
                Create account
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreating(false)
                  setFieldErrors({})
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        {users === null ? (
          <TableSkeleton rows={4} columns={5} />
        ) : users.length === 0 ? (
          !error && <EmptyState title="No accounts" />
        ) : (
          <ul className="divide-y divide-white/5">
            {users.map((account) => {
              const isSelf = account.id === currentUser?.id
              const busy = busyId === account.id

              return (
                <li key={account.id} className="px-4 py-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink-100">
                        <Link to={`/team/${account.id}`} className="truncate hover:text-brand-200">
                          {account.name}
                        </Link>
                        {isSelf && (
                          <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-normal text-brand-200 ring-1 ring-inset ring-brand-400/25">
                            You
                          </span>
                        )}
                        {!account.enabled && (
                          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-normal text-red-300 ring-1 ring-inset ring-red-500/25">
                            Disabled
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-ink-300">{account.email}</p>
                      <p className="mt-1 text-xs text-ink-500">
                        {account.reportCount === 0
                          ? 'No reports'
                          : `${account.reportCount} report${account.reportCount === 1 ? '' : 's'}`}{' '}
                        · joined {formatDate(account.createdAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {isSelf ? (
                        <span className="rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-ink-500 ring-1 ring-inset ring-white/10">
                          {ROLE_LABELS[account.role]} · your own account
                        </span>
                      ) : (
                        <>
                          <label>
                            <span className="sr-only">Role for {account.name}</span>
                            <select
                              value={account.role}
                              disabled={busy}
                              onChange={(event) =>
                                save(account, { role: event.target.value as Role })
                              }
                              className="rounded-lg bg-navy-900/70 px-2.5 py-1.5 text-xs text-ink-100 ring-1 ring-inset ring-white/10 transition hover:ring-white/20 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none disabled:opacity-50"
                            >
                              <option value="TEAM_MEMBER">Team member</option>
                              <option value="MANAGER">Manager</option>
                            </select>
                          </label>

                          <RowButton
                            onClick={() => save(account, { enabled: !account.enabled })}
                            disabled={busy}
                          >
                            {account.enabled ? 'Disable' : 'Enable'}
                          </RowButton>

                          {account.reportCount === 0 &&
                            (confirmId === account.id ? (
                              <>
                                <RowButton
                                  tone="danger"
                                  onClick={() => handleDelete(account)}
                                  disabled={busy}
                                >
                                  Confirm delete
                                </RowButton>
                                <RowButton onClick={() => setConfirmId(null)}>Cancel</RowButton>
                              </>
                            ) : (
                              <RowButton tone="danger" onClick={() => setConfirmId(account.id)}>
                                Delete
                              </RowButton>
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <p className="text-xs text-ink-500">
        Accounts created here get a password you pass on directly. A production system would
        email an invitation token instead — that needs mail infrastructure this project
        doesn&apos;t have.
      </p>
    </section>
  )
}

/** Alphabetical, matching the backend's order, so a role change doesn't reorder the list. */
function sorted(users: UserDetail[]): UserDetail[] {
  return [...users].sort((left, right) => left.name.localeCompare(right.name))
}

function RowButton({
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'neutral' | 'danger'
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-300 ring-red-500/25 hover:bg-red-500/10 hover:text-red-200'
      : 'text-ink-300 ring-white/10 hover:bg-white/5 hover:text-ink-100'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  )
}
