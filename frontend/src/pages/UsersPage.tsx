import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, errorMessage } from '../api/client'
import { createUser, deleteUser, listUsers, updateUser } from '../api/users'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Pagination } from '../components/Pagination'
import { PasswordField } from '../components/PasswordField'
import { RowButton } from '../components/RowButton'
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

/** Ten accounts a page. A team, not a directory. */
const PAGE_SIZE = 10

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
  const [pageNumber, setPageNumber] = useState(0)

  /*
   * Filtered in the browser, like the pagination below it and for the same reason: the whole
   * account list arrives in one response, so there is nothing to push to the server without
   * changing that endpoint - and a team is not a directory.
   */
  const [search, setSearch] = useState('')
  const [enabledFilter, setEnabledFilter] = useState<'ALL' | 'ENABLED' | 'DISABLED'>('ALL')
  const [roleFilter, setRoleFilter] = useState<'ALL' | Role>('ALL')

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

  /*
   * Paginated in the browser. `GET /api/users` returns every account in one unpaginated
   * response, so there is nothing to page on the server without changing that endpoint - and
   * the count here is a team, not a directory.
   *
   * `currentPage` is clamped during render rather than reset from an effect: deleting the
   * last account on a page would otherwise leave `pageNumber` past the end. Deriving what to
   * show beats chasing it with a setState, which is also what this repo's
   * `react(set-state-in-effect)` rule asks for.
   */
  /**
   * Matches the search against the name *and* the email. Two people can share a name in this
   * app - the list already disambiguates them by email elsewhere - so searching only names
   * would leave the one case you most need to search for unreachable.
   *
   * Both sides are lower-cased rather than using a case-insensitive regex: the term is user
   * input and would otherwise need escaping before it could be a pattern.
   */
  function matches(account: UserDetail): boolean {
    if (enabledFilter === 'ENABLED' && !account.enabled) return false
    if (enabledFilter === 'DISABLED' && account.enabled) return false
    if (roleFilter !== 'ALL' && account.role !== roleFilter) return false

    const term = search.trim().toLowerCase()
    if (term === '') return true
    return (
      account.name.toLowerCase().includes(term) || account.email.toLowerCase().includes(term)
    )
  }

  const all = users ?? []
  const accounts = all.filter(matches)
  /*
   * Looked up in `all`, not in the current page. The popup is open while the list can still be
   * re-filtered or paged underneath it, and losing the subject would leave a dialog asking to
   * delete nothing - the same failure the draft delete had.
   */
  const pendingDelete = confirmId === null ? undefined : all.find((a) => a.id === confirmId)
  const filtered = search.trim() !== '' || enabledFilter !== 'ALL' || roleFilter !== 'ALL'

  const totalPages = Math.max(1, Math.ceil(accounts.length / PAGE_SIZE))
  // Clamped during render: narrowing a filter or deleting the last row on a page can both
  // leave `pageNumber` past the end.
  const currentPage = Math.min(pageNumber, totalPages - 1)
  const pageAccounts = accounts.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  /** Any filter change returns to the first page of the new result. */
  function onFilterChange(apply: () => void) {
    apply()
    setPageNumber(0)
  }

  function clearFilters() {
    setSearch('')
    setEnabledFilter('ALL')
    setRoleFilter('ALL')
    setPageNumber(0)
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
            {/* A toggle matters more here than on a sign-in form: a manager is typing a
                password they then have to read out or pass on to somebody else, so being
                unable to check it is what causes the "it doesn't work" follow-up. */}
            <PasswordField
              label="Initial password"
              name="new-user-password"
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

      {/* Hidden until there is something to filter. On a phone the four controls stack; from
          `sm` the two dropdowns pair up, and from `lg` the search takes the remaining width. */}
      {users !== null && all.length > 0 && (
        <div className="rounded-xl bg-navy-800 p-4 shadow-lg shadow-black/20 ring-1 ring-white/5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_11rem]">
            <label className="sm:col-span-2 lg:col-span-1">
              <span className="block text-sm font-medium text-ink-300">Search</span>
              <div className="relative mt-1.5">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => onFilterChange(() => setSearch(event.target.value))}
                  placeholder="Name or email..."
                  aria-label="Search accounts by name or email"
                  /* pr-9 leaves room for the clear button, and the bracket rule removes the
                     browser's own search cross - it cannot be styled and would sit beside
                     ours looking like a duplicate. */
                  className="block w-full appearance-none rounded-lg bg-navy-900/70 py-2 pl-3 pr-9 text-sm text-ink-100 ring-1 ring-inset ring-white/10 transition placeholder:text-ink-500 hover:ring-white/20 focus:bg-navy-900 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
                />
                {search !== '' && (
                  <button
                    type="button"
                    onClick={() => onFilterChange(() => setSearch(''))}
                    aria-label="Clear search"
                    title="Clear search"
                    className="absolute inset-y-0 right-0 grid w-9 place-items-center text-ink-500 transition hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true" className="size-4">
                      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </div>
            </label>

            <SelectField
              label="Role"
              name="role-filter"
              value={roleFilter}
              onChange={(event) =>
                onFilterChange(() => setRoleFilter(event.target.value as typeof roleFilter))
              }
            >
              <option value="ALL">All roles</option>
              <option value="TEAM_MEMBER">Team member</option>
              <option value="MANAGER">Manager</option>
            </SelectField>

            <SelectField
              label="Status"
              name="status-filter"
              value={enabledFilter}
              onChange={(event) =>
                onFilterChange(() => setEnabledFilter(event.target.value as typeof enabledFilter))
              }
            >
              <option value="ALL">All statuses</option>
              <option value="ENABLED">Enabled</option>
              <option value="DISABLED">Disabled</option>
            </SelectField>
          </div>

          {filtered && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-ink-500">
                Showing <span className="text-ink-300">{accounts.length}</span> of {all.length}{' '}
                account{all.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-brand-300 transition hover:text-brand-200"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      )}

      <Card>
        {users === null ? (
          <TableSkeleton rows={4} columns={5} />
        ) : all.length === 0 ? (
          !error && <EmptyState title="No accounts" />
        ) : accounts.length === 0 ? (
          /* Distinct from "no accounts": there are accounts, just none matching. */
          <EmptyState
            title="No accounts match"
            description="Nothing matches the current search, role and status."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {pageAccounts.map((account) => {
              const isSelf = account.id === currentUser?.id
              const busy = busyId === account.id

              return (
                /* `group` drives the hover styling. Matches the Projects list, so the two
                   admin pages behave the same way under the pointer. */
                <li
                  key={account.id}
                  className="group px-4 py-3.5 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-base font-medium text-ink-100">
                        {/* The row tints the name emerald; pointing at the link itself adds
                            an underline. Colour was tried for that second level and dropped:
                            `group-hover:` and `hover:` have equal specificity, so which one
                            won came down to Tailwind's output order. An underline is a
                            different property, so the two compose instead of competing. */}
                        <Link
                          to={`/team/${account.id}`}
                          className="truncate transition-colors group-hover:text-emerald-300 hover:underline hover:underline-offset-4"
                        >
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

                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
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
                              className="rounded-lg bg-navy-900/70 py-1.5 pl-2.5 pr-8 text-xs text-ink-100 ring-1 ring-inset ring-white/10 transition hover:ring-white/20 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none disabled:opacity-50"
                            >
                              <option value="TEAM_MEMBER">Team member</option>
                              <option value="MANAGER">Manager</option>
                            </select>
                          </label>

                          {/* The tone follows the label: amber for taking an account out
                              of service, emerald for restoring it. */}
                          <RowButton
                            tone={account.enabled ? 'retire' : 'restore'}
                            onClick={() => save(account, { enabled: !account.enabled })}
                            disabled={busy}
                          >
                            {account.enabled ? 'Disable' : 'Enable'}
                          </RowButton>

                          {/* Offered only for an account with no reports: authorship is part
                              of the audit trail, so anyone who has filed can be disabled but
                              never deleted, and the backend refuses it. */}
                          {account.reportCount === 0 && (
                            <RowButton tone="danger" onClick={() => setConfirmId(account.id)}>
                              Delete
                            </RowButton>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {/* Hidden on a single page: a control that can only say "1 of 1" is noise. */}
        {users !== null && accounts.length > PAGE_SIZE && (
          <Pagination
            page={currentPage}
            size={PAGE_SIZE}
            totalElements={accounts.length}
            totalPages={totalPages}
            first={currentPage === 0}
            last={currentPage >= totalPages - 1}
            onChange={setPageNumber}
          />
        )}
      </Card>

      <p className="text-xs text-ink-500">
        Accounts created here get a password you pass on directly. A production system would
        email an invitation token instead — that needs mail infrastructure this project
        doesn&apos;t have.
      </p>

      {/* The same confirmation the draft and project deletes use, so a destructive action
          asks the same way everywhere in the app. */}
      <ConfirmDialog
        open={pendingDelete !== undefined}
        title={'Delete ' + (pendingDelete?.name ?? '') + '?'}
        confirmLabel={busyId === confirmId ? 'Deleting...' : 'Yes, delete'}
        cancelLabel="No"
        loading={busyId === confirmId}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete)
        }}
        onCancel={() => setConfirmId(null)}
      >
        {pendingDelete?.email} has filed no reports, so nothing loses its author. The account
        is removed permanently and this cannot be undone.
      </ConfirmDialog>
    </section>
  )
}

/** Alphabetical, matching the backend's order, so a role change doesn't reorder the list. */
function sorted(users: UserDetail[]): UserDetail[] {
  return [...users].sort((left, right) => left.name.localeCompare(right.name))
}
