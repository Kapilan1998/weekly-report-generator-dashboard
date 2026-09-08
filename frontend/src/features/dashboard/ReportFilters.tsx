import { mondayOf } from '../../lib/week'
import { EMPTY_FILTERS, isFiltered } from './reportFilterState'
import type { TeamReportFilterValue } from './reportFilterState'
import type { ProjectDetail, ReportStatus, UserDetail } from '../../types/api'

/**
 * The brief's four filters over the team report list: team member, project, status and a
 * date range.
 *
 * Status is multi-select because the backend binds a repeatable `status` parameter, and
 * "submitted or needs correction" — everything that wants a manager's attention — is the
 * query a manager actually runs. Chips make that possible without a multi-select listbox,
 * which is awkward on a phone.
 *
 * The values themselves live in `reportFilterState.ts`; see the note there.
 */
const STATUSES: { value: ReportStatus; label: string; on: string }[] = [
  { value: 'SUBMITTED', label: 'Submitted', on: 'bg-sky-400/20 text-sky-200 ring-sky-400/40' },
  {
    value: 'NEEDS_CORRECTION',
    label: 'Needs correction',
    on: 'bg-amber-400/20 text-amber-200 ring-amber-400/40',
  },
  { value: 'APPROVED', label: 'Approved', on: 'bg-emerald-400/20 text-emerald-200 ring-emerald-400/40' },
  { value: 'DRAFT', label: 'Draft', on: 'bg-slate-400/20 text-ink-100 ring-white/25' },
]

const selectClass =
  'mt-1.5 w-full rounded-lg bg-navy-900/70 px-3 py-2 text-sm text-ink-100 ring-1 ring-inset ring-white/10 transition hover:ring-white/20 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none'
const labelClass = 'block text-xs font-semibold tracking-wide text-ink-500 uppercase'

export function ReportFilters({
  value,
  onChange,
  members,
  projects,
}: {
  value: TeamReportFilterValue
  onChange: (next: TeamReportFilterValue) => void
  members: UserDetail[]
  projects: ProjectDetail[]
}) {
  // Two people can share a name, and the report list carries names only. Where that
  // happens the email disambiguates - it is already on screen on the user management page,
  // so this exposes nothing new to an audience that couldn't already see it.
  const duplicateNames = new Set(
    members
      .map((member) => member.name)
      .filter((name, index, all) => all.indexOf(name) !== index),
  )

  function toggleStatus(status: ReportStatus) {
    onChange({
      ...value,
      // Selecting a real status turns "not started" off: it is answered by a different
      // query, so the two can't both be in effect. See the note in reportFilterState.ts.
      notStarted: false,
      statuses: value.statuses.includes(status)
        ? value.statuses.filter((entry) => entry !== status)
        : [...value.statuses, status],
    })
  }

  function toggleNotStarted() {
    onChange({ ...value, statuses: [], notStarted: !value.notStarted })
  }

  return (
    <div className="rounded-xl bg-navy-800 p-4 shadow-lg shadow-black/20 ring-1 ring-white/5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label>
          <span className={labelClass}>Team member</span>
          <select
            value={value.userId}
            onChange={(event) =>
              onChange({
                ...value,
                userId: event.target.value === 'ALL' ? 'ALL' : Number(event.target.value),
              })
            }
            className={selectClass}
          >
            <option value="ALL">Everyone</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
                {duplicateNames.has(member.name) ? ` — ${member.email}` : ''}
                {member.enabled ? '' : ' (disabled)'}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={labelClass}>Project</span>
          <select
            value={value.projectId}
            onChange={(event) =>
              onChange({
                ...value,
                projectId: event.target.value === 'ALL' ? 'ALL' : Number(event.target.value),
              })
            }
            className={selectClass}
          >
            <option value="ALL">All projects</option>
            {/* Inactive projects are included: reports filed before one was retired still
                reference it, and filtering to it has to stay possible. */}
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
                {project.active ? '' : ' (inactive)'}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className={labelClass}>Weeks from</span>
          <input
            type="date"
            value={value.weekFrom}
            onChange={(event) =>
              onChange({ ...value, weekFrom: mondayOf(event.target.value) })
            }
            className={selectClass}
          />
        </label>

        <label>
          <span className={labelClass}>Weeks to</span>
          <input
            type="date"
            value={value.weekTo}
            onChange={(event) => onChange({ ...value, weekTo: mondayOf(event.target.value) })}
            className={selectClass}
          />
        </label>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className={labelClass}>Status</span>
        {STATUSES.map((status) => {
          const active = value.statuses.includes(status.value)
          return (
            <button
              key={status.value}
              type="button"
              aria-pressed={active}
              onClick={() => toggleStatus(status.value)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                active
                  ? status.on
                  : 'text-ink-300 ring-white/10 hover:bg-white/5 hover:text-ink-100'
              }`}
            >
              {status.label}
            </button>
          )
        })}

        {/* The brief's fifth status. Set apart by the divider because it answers a
            different question - who has no report at all for the selected week. */}
        <span aria-hidden="true" className="mx-1 h-4 w-px bg-white/10" />
        <button
          type="button"
          aria-pressed={value.notStarted}
          onClick={toggleNotStarted}
          title="Members with no report for the selected week"
          className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
            value.notStarted
              ? 'bg-white/15 text-ink-100 ring-white/30'
              : 'text-ink-300 ring-white/10 hover:bg-white/5 hover:text-ink-100'
          }`}
        >
          Not started
        </button>

        {isFiltered(value) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="ml-auto text-xs font-medium text-brand-300 transition hover:text-brand-200"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  )
}
