import type { ReportStatus } from '../types/api'

/**
 * Translucent chips rather than the usual pale pastels: on a dark surface a `-50` tint
 * would be a bright patch, which is exactly what this theme avoids.
 * `null` renders the brief's fifth state, "not yet started" — no report row for that week.
 */
const STYLES: Record<ReportStatus | 'NOT_STARTED', { label: string; chip: string; dot: string }> = {
  DRAFT: {
    label: 'Draft',
    chip: 'bg-slate-400/10 text-ink-300 ring-white/10',
    dot: 'bg-slate-400',
  },
  SUBMITTED: {
    label: 'Submitted',
    chip: 'bg-sky-400/10 text-sky-300 ring-sky-400/25',
    dot: 'bg-sky-400',
  },
  NEEDS_CORRECTION: {
    label: 'Needs correction',
    chip: 'bg-amber-400/10 text-amber-300 ring-amber-400/25',
    dot: 'bg-amber-400',
  },
  APPROVED: {
    label: 'Approved',
    chip: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/25',
    dot: 'bg-emerald-400',
  },
  NOT_STARTED: {
    label: 'Not started',
    chip: 'bg-white/5 text-ink-500 ring-white/10',
    dot: 'bg-ink-500',
  },
}

export function StatusBadge({ status }: { status: ReportStatus | null }) {
  const { label, chip, dot } = STYLES[status ?? 'NOT_STARTED']
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap ring-1 ring-inset ${chip}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
