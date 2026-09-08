import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { errorMessage } from '../api/client'
import { getReport, listTeamReports } from '../api/reports'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { WeekPicker } from '../features/dashboard/WeekPicker'
import { formatHours, humanizeEnum } from '../lib/format'
import { fresh } from '../lib/keyed'
import type { Keyed } from '../lib/keyed'
import { currentMonday } from '../lib/week'
import type { ReportDetail } from '../types/api'

/** The sections worth comparing across people — the ones that are about the team, not a task list. */
const SECTIONS = [
  { key: 'blockers', label: 'Blockers' },
  { key: 'achievements', label: 'Achievements' },
  { key: 'planned', label: 'Planned next week' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'hours', label: 'Hours breakdown' },
  { key: 'notes', label: 'Notes & links' },
] as const

type SectionKey = (typeof SECTIONS)[number]['key']

/**
 * The brief's bonus view: one section of every team member's report for a chosen week, side
 * by side — read all the blockers at once instead of opening eight reports to find them.
 *
 * **How it gets the data.** There is no endpoint that returns one section across the team,
 * so this lists the week's reports and then fetches each one's detail. That is N+1 requests,
 * which is the honest trade: the alternative is a new backend endpoint returning a slice of
 * report content, and N here is the size of a team — the fetches run in parallel and a week
 * has at most one report per member. If a team ever outgrew that, the fix is the endpoint,
 * not a bigger page size.
 *
 * **Whose reports appear.** A manager may not read another member's draft, so other people's
 * drafts are filtered out before fetching rather than left to fail — and the count of what
 * was skipped is shown, since a silently short list would read as "nobody had blockers".
 */
interface WeekSlice {
  reports: ReportDetail[]
  /** Other people's drafts, counted so a short list isn't read as "nobody had blockers". */
  privateDrafts: number
  message: string | null
}

export function SectionComparePage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const week = searchParams.get('week') || currentMonday()
  const section = (searchParams.get('section') as SectionKey | null) ?? 'blockers'

  // Keyed by the week it was fetched for, so switching weeks shows the skeleton rather
  // than last week's cards, without clearing state from inside the effect. The failure
  // message rides along in the same value, so it clears with the week too.
  const [slice, setSlice] = useState<Keyed<WeekSlice> | null>(null)
  const key = `${week}:${user?.id ?? ''}`
  const data = fresh(slice, key)

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams)
    params.set(key, value)
    setSearchParams(params, { replace: true })
  }

  useEffect(() => {
    let active = true
    const fetchKey = `${week}:${user?.id ?? ''}`
    let privateDrafts = 0

    listTeamReports({ weekStart: week, size: 50, sort: 'user.name,asc' })
      .then((page) => {
        const readable = page.content.filter(
          (summary) => summary.status !== 'DRAFT' || summary.owner.id === user?.id,
        )
        privateDrafts = page.content.length - readable.length

        // Each detail fetch fails independently: one report going missing mid-render
        // shouldn't blank the whole comparison.
        return Promise.all(readable.map((summary) => getReport(summary.id).catch(() => null)))
      })
      .then((details) => {
        if (!active) return
        setSlice({
          key: fetchKey,
          data: {
            reports: details.filter((detail): detail is ReportDetail => detail !== null),
            privateDrafts,
            message: null,
          },
        })
      })
      .catch((caught: unknown) => {
        if (!active) return
        setSlice({
          key: fetchKey,
          data: {
            reports: [],
            privateDrafts: 0,
            message: errorMessage(caught, 'Could not load the week.'),
          },
        })
      })

    return () => {
      active = false
    }
  }, [week, user?.id])

  const sectionLabel = SECTIONS.find((entry) => entry.key === section)?.label ?? 'Blockers'

  return (
    <section className="animate-fade-up space-y-4">
      <PageHeader
        title="Compare sections"
        description="One section of every report for a week, across the team."
        actions={
          <div className="flex flex-wrap items-end gap-3">
            <WeekPicker value={week} onChange={(next) => setParam('week', next)} />
            <Link
              to={`/team?week=${week}`}
              className="rounded-lg bg-navy-800 px-3.5 py-2 text-sm font-medium text-ink-100 ring-1 ring-inset ring-white/10 transition hover:ring-white/20"
            >
              Back to dashboard
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            aria-pressed={entry.key === section}
            onClick={() => setParam('section', entry.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
              entry.key === section
                ? 'bg-brand-500/20 text-brand-100 ring-brand-400/40'
                : 'text-ink-300 ring-white/10 hover:bg-white/5 hover:text-ink-100'
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {data?.message && <Alert>{data.message}</Alert>}

      {data && data.privateDrafts > 0 && (
        <Alert tone="info">
          {data.privateDrafts} report{data.privateDrafts === 1 ? '' : 's'} for this week{' '}
          {data.privateDrafts === 1 ? 'is' : 'are'} still a draft, so{' '}
          {data.privateDrafts === 1 ? 'its' : 'their'} content stays private to the author.
        </Alert>
      )}

      {data === null ? (
        <Card>
          <TableSkeleton rows={4} columns={3} />
        </Card>
      ) : data.reports.length === 0 ? (
        !data.message && (
          <Card>
            <EmptyState
              title="Nothing to compare"
              description="No readable reports were filed for this week."
            />
          </Card>
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.reports.map((report) => (
            <Card key={report.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2 border-b border-white/5 bg-navy-700/30 px-4 py-3">
                <div className="min-w-0">
                  <Link
                    to={`/reports/${report.id}`}
                    className="block truncate text-sm font-semibold text-ink-100 transition hover:text-brand-200"
                  >
                    {report.owner.name}
                  </Link>
                  <p className="truncate text-xs text-ink-500">
                    {report.project.name} · v{report.content.versionNumber}
                  </p>
                </div>
                <StatusBadge status={report.status} />
              </div>

              <div className="flex-1 px-4 py-3.5 text-sm">
                <SectionBody report={report} section={section} />
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-ink-500">
        Showing <span className="text-ink-300">{sectionLabel}</span> from each report&apos;s
        current version.
      </p>
    </section>
  )
}

function Nothing({ label }: { label: string }) {
  return <p className="text-sm text-ink-500">{label}</p>
}

function SectionBody({ report, section }: { report: ReportDetail; section: SectionKey }) {
  const content = report.content

  if (section === 'blockers') {
    if (content.blockers.length === 0) return <Nothing label="No blockers reported." />
    return (
      <ul className="space-y-2">
        {content.blockers.map((blocker) => (
          <li key={blocker.id} className="flex gap-2 text-ink-300">
            <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-red-400" />
            <span className="min-w-0 break-words">
              {blocker.description}
              {blocker.keyIssue && <KeyTag label="Key issue" />}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (section === 'achievements') {
    if (content.achievements.length === 0) return <Nothing label="No achievements listed." />
    return (
      <ul className="space-y-2">
        {content.achievements.map((achievement) => (
          <li key={achievement.id} className="flex gap-2 text-ink-300">
            <span
              aria-hidden="true"
              className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-400"
            />
            <span className="min-w-0 break-words">
              {achievement.description}
              {achievement.keyAchievement && <KeyTag label="Key" />}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (section === 'planned') {
    return content.tasksPlannedNextWeek ? (
      <p className="break-words whitespace-pre-wrap text-ink-300">{content.tasksPlannedNextWeek}</p>
    ) : (
      <Nothing label="Nothing recorded." />
    )
  }

  if (section === 'tasks') {
    if (content.tasks.length === 0) return <Nothing label="No tasks listed." />
    return (
      <ul className="space-y-2">
        {content.tasks.map((task) => (
          <li key={task.id} className="flex items-start justify-between gap-2">
            <span className="min-w-0 break-words text-ink-300">{task.taskName}</span>
            <span className="shrink-0 text-xs text-ink-500">
              {humanizeEnum(task.status)} · {formatHours(task.timeSpentHours)}
            </span>
          </li>
        ))}
      </ul>
    )
  }

  if (section === 'hours') {
    const total = content.hours.reduce((sum, entry) => sum + Number(entry.hours), 0)
    return (
      <>
        <ul className="space-y-1.5">
          {content.hours.map((entry) => (
            <li key={entry.taskType} className="flex justify-between gap-2">
              <span className="text-ink-300">{humanizeEnum(entry.taskType)}</span>
              <span className="text-ink-100 tabular-nums">{formatHours(entry.hours)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2.5 flex justify-between gap-2 border-t border-white/5 pt-2 text-sm font-medium">
          <span className="text-ink-500">Total</span>
          <span className="text-ink-100 tabular-nums">{formatHours(total)}</span>
        </p>
      </>
    )
  }

  // notes & links
  return (
    <div className="space-y-2.5">
      {content.notes ? (
        <p className="break-words whitespace-pre-wrap text-ink-300">{content.notes}</p>
      ) : (
        <Nothing label="No notes." />
      )}
      {content.links && (
        <p className="break-all text-xs text-brand-300">{content.links}</p>
      )}
    </div>
  )
}

function KeyTag({ label }: { label: string }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/25">
      ★ {label}
    </span>
  )
}
