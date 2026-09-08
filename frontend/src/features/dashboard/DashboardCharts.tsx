import type { ReactNode } from 'react'
import { BarList } from '../../components/charts/BarList'
import { ColumnChart } from '../../components/charts/ColumnChart'
import { StackedBarList } from '../../components/charts/StackedBarList'
import { formatDate, formatDayMonth, formatHours, humanizeEnum } from '../../lib/format'
import { weekEndOf } from '../../lib/week'
import type { DashboardCharts as ChartsData, ReportStatus } from '../../types/api'

/**
 * The four chart datasets, each in its own panel.
 *
 * Every number here is already restricted to each report's current version by the backend
 * queries — a report that went through a correction cycle is counted once, not once per
 * version. Nothing on this side re-aggregates, so that guarantee holds.
 */

/** Fixed order and colours, in step with StatusBadge so a colour means one status app-wide. */
const STATUS_SEGMENTS: { key: ReportStatus; label: string; className: string }[] = [
  { key: 'APPROVED', label: 'Approved', className: 'bg-emerald-400' },
  { key: 'SUBMITTED', label: 'Submitted', className: 'bg-sky-400' },
  { key: 'NEEDS_CORRECTION', label: 'Needs correction', className: 'bg-amber-400' },
  { key: 'DRAFT', label: 'Draft', className: 'bg-slate-400' },
]

function ChartCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl bg-navy-800 p-4 shadow-lg shadow-black/20 ring-1 ring-white/5">
      <h2 className="text-sm font-semibold text-ink-100">{title}</h2>
      <p className="mt-0.5 mb-4 text-xs text-ink-500">{description}</p>
      {children}
    </section>
  )
}

function NoData({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-ink-500">{message}</p>
}

export function DashboardCharts({ charts, weeks }: { charts: ChartsData; weeks: number }) {
  const windowLabel = `Last ${weeks} week${weeks === 1 ? '' : 's'}`

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <ChartCard
        title="Tasks completed per week"
        description={`${windowLabel} · tasks marked Done across the team`}
      >
        <ColumnChart
          ariaLabel="Tasks completed per week"
          data={charts.tasksCompletedTrend.map((point) => ({
            label: formatDayMonth(point.weekStart),
            value: point.completedTasks,
            title: `${formatDate(point.weekStart)} – ${formatDate(weekEndOf(point.weekStart))}: ${point.completedTasks} completed`,
          }))}
        />
      </ChartCard>

      <ChartCard title="Reports by status" description={`${windowLabel} · every team member`}>
        {charts.statusByMember.length === 0 ? (
          <NoData message="No team members yet." />
        ) : (
          <StackedBarList
            ariaLabel="Reports by status, per team member"
            legend={STATUS_SEGMENTS}
            data={charts.statusByMember.map((row) => ({
              key: row.member.id,
              label: row.member.name,
              segments: STATUS_SEGMENTS.map((segment) => ({
                key: segment.key,
                label: segment.label,
                // Absent rather than zero when a member has none of that status.
                value: row.counts[segment.key] ?? 0,
                className: segment.className,
              })),
            }))}
          />
        )}
      </ChartCard>

      <ChartCard
        title="Workload by project"
        description={`${windowLabel} · hours spent, with the number of reports`}
      >
        {charts.workloadByProject.length === 0 ? (
          <NoData message="No reports in this window." />
        ) : (
          <BarList
            ariaLabel="Hours spent per project"
            formatValue={formatHours}
            data={charts.workloadByProject.map((point) => ({
              key: point.projectId,
              label: point.projectName,
              value: Number(point.hoursSpent),
              meta: `${point.reportCount} report${point.reportCount === 1 ? '' : 's'}`,
            }))}
          />
        )}
      </ChartCard>

      <ChartCard
        title="Hours by task type"
        description={`${windowLabel} · from each report's hours breakdown`}
      >
        <BarList
          ariaLabel="Hours by task type"
          tone="emerald"
          formatValue={formatHours}
          data={charts.hoursByTaskType.map((point) => ({
            key: point.taskType,
            label: humanizeEnum(point.taskType),
            value: Number(point.hours),
          }))}
        />
      </ChartCard>
    </div>
  )
}
