import { formatDateTime } from '../../lib/format'
import type { ReportContent, TaskPriority, TaskWorkStatus } from '../../types/api'

function humanize(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  LOW: 'bg-slate-400/10 text-ink-300 ring-white/10',
  MEDIUM: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
  HIGH: 'bg-orange-400/10 text-orange-300 ring-orange-400/25',
}

const TASK_STATUS_STYLES: Record<TaskWorkStatus, string> = {
  NOT_STARTED: 'bg-slate-400/10 text-ink-300 ring-white/10',
  IN_PROGRESS: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
  DONE: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
  BLOCKED: 'bg-red-400/10 text-red-300 ring-red-400/25',
}

function Chip({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-white/5 px-4 py-4 sm:px-5">
      <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-500 uppercase">{title}</h3>
      {children}
    </section>
  )
}

function KeyTag({ label }: { label: string }) {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-medium text-amber-300 ring-1 ring-inset ring-amber-400/25">
      ★ {label}
    </span>
  )
}

/**
 * Read-only rendering of one version's content — used by the detail page and by the
 * past-version viewer, so a historical version is displayed exactly as the current one is.
 */
export function ReportContentView({ content }: { content: ReportContent }) {
  const totalHours = content.hours.reduce((sum, entry) => sum + Number(entry.hours), 0)

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm sm:px-5">
        <span className="font-medium text-ink-100">Version {content.versionNumber}</span>
        <span aria-hidden="true" className="text-ink-500">
          ·
        </span>
        {content.submittedAt ? (
          <span className="text-ink-300">Submitted {formatDateTime(content.submittedAt)}</span>
        ) : (
          <span className="text-amber-300">Working copy — not yet submitted</span>
        )}
      </div>

      <Section title="Tasks completed">
        {content.tasks.length === 0 ? (
          <p className="text-sm text-ink-500">No tasks recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">
            <table className="min-w-[46rem] text-sm">
              <thead className="bg-navy-700/50 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase">
                <tr>
                  <th className="px-3 py-2.5">Task</th>
                  <th className="px-3 py-2.5">Priority</th>
                  <th className="px-3 py-2.5">Planned %</th>
                  <th className="px-3 py-2.5">Actual %</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Planned (h)</th>
                  <th className="px-3 py-2.5">Spent (h)</th>
                  <th className="px-3 py-2.5">Output</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {content.tasks.map((task) => (
                  <tr key={task.id}>
                    <td className="px-3 py-2.5 font-medium text-ink-100">{task.taskName}</td>
                    <td className="px-3 py-2.5">
                      <Chip label={humanize(task.priority)} className={PRIORITY_STYLES[task.priority]} />
                    </td>
                    <td className="px-3 py-2.5 text-ink-300">{task.plannedPercent}%</td>
                    <td className="px-3 py-2.5 text-ink-300">{task.actualPercent}%</td>
                    <td className="px-3 py-2.5">
                      <Chip label={humanize(task.status)} className={TASK_STATUS_STYLES[task.status]} />
                    </td>
                    <td className="px-3 py-2.5 text-ink-300">{task.timePlannedHours}</td>
                    <td className="px-3 py-2.5 text-ink-300">{task.timeSpentHours}</td>
                    <td className="px-3 py-2.5 text-ink-300">{task.outputDeliverable ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Tasks planned for next week">
        <p className="text-sm break-words whitespace-pre-wrap text-ink-100">
          {content.tasksPlannedNextWeek ?? <span className="text-ink-500">Not filled in.</span>}
        </p>
      </Section>

      <Section title="Blockers / challenges">
        {content.blockers.length === 0 ? (
          <p className="text-sm text-ink-500">None reported.</p>
        ) : (
          <ul className="space-y-1.5">
            {content.blockers.map((blocker) => (
              <li key={blocker.id} className="text-sm break-words whitespace-pre-wrap text-ink-100">
                {blocker.description}
                {blocker.keyIssue && <KeyTag label="Key issue" />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Achievements / highlights">
        {content.achievements.length === 0 ? (
          <p className="text-sm text-ink-500">None reported.</p>
        ) : (
          <ul className="space-y-1.5">
            {content.achievements.map((achievement) => (
              <li key={achievement.id} className="text-sm break-words whitespace-pre-wrap text-ink-100">
                {achievement.description}
                {achievement.keyAchievement && <KeyTag label="Key achievement" />}
              </li>
            ))}
          </ul>
        )}
      </Section>

      {content.hours.length > 0 && (
        <Section title="Hours by task type">
          <div className="flex flex-wrap gap-2">
            {content.hours.map((entry) => (
              <span
                key={entry.taskType}
                className="rounded-lg bg-navy-900/50 px-3 py-1.5 text-sm ring-1 ring-inset ring-white/5"
              >
                <span className="text-ink-300">{humanize(entry.taskType)}</span>{' '}
                <span className="font-medium text-ink-100">{entry.hours} h</span>
              </span>
            ))}
            <span className="rounded-lg bg-brand-500/10 px-3 py-1.5 text-sm ring-1 ring-inset ring-brand-400/25">
              <span className="text-brand-200">Total</span>{' '}
              <span className="font-medium text-ink-100">{totalHours.toFixed(2)} h</span>
            </span>
          </div>
        </Section>
      )}

      {(content.notes || content.links) && (
        <Section title="Notes & links">
          {content.notes && (
            <p className="text-sm break-words whitespace-pre-wrap text-ink-100">{content.notes}</p>
          )}
          {content.links && (
            <ul className="mt-2 space-y-1">
              {content.links
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line, index) => (
                  <li key={index} className="text-sm">
                    {/^https?:\/\//i.test(line) ? (
                      <a
                        href={line}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="break-all text-brand-300 underline-offset-4 hover:text-brand-200 hover:underline"
                      >
                        {line}
                      </a>
                    ) : (
                      <span className="break-all text-ink-300">{line}</span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </Section>
      )}
    </div>
  )
}
