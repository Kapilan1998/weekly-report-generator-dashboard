import { WeekField } from '../../components/WeekField'
import { formatWeek } from '../../lib/format'
import { weekEndOf } from '../../lib/week'

/**
 * The dashboard's week control: step back and forward a week, or open a calendar.
 *
 * `<input type="week">` would be the obvious control, but it is still Chromium-only and its
 * ISO week numbering is a second thing to reconcile with the backend. `WeekField` picks whole
 * weeks directly and always emits the Monday the API expects, so nothing here has to
 * normalise on the way out; the resolved range is still printed underneath.
 */
export function WeekPicker({
  value,
  onChange,
  label = 'Week',
}: {
  value: string
  onChange: (mondayIso: string) => void
  label?: string
}) {
  function shift(weeks: number) {
    const monday = new Date(`${value}T00:00:00`)
    if (Number.isNaN(monday.getTime())) return
    monday.setDate(monday.getDate() + weeks * 7)
    const month = String(monday.getMonth() + 1).padStart(2, '0')
    const day = String(monday.getDate()).padStart(2, '0')
    onChange(`${monday.getFullYear()}-${month}-${day}`)
  }

  const stepClass =
    'grid size-9 shrink-0 place-items-center rounded-lg text-ink-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/5 hover:text-ink-100'

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => shift(-1)} aria-label="Previous week" className={stepClass}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l-5 5 5 5" />
          </svg>
        </button>

        <WeekField
          label={label}
          labelHidden
          value={value}
          // Empty is not a choice here - the dashboard always shows some week - so the
          // previous value stands if the calendar ever hands back nothing.
          onChange={(monday) => onChange(monday || value)}
          className="min-w-0"
          triggerClassName="w-52"
          surface="raised"
          size="sm"
        />

        <button type="button" onClick={() => shift(1)} aria-label="Next week" className={stepClass}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8 5 5 5-5 5" />
          </svg>
        </button>
      </div>
      <p className="mt-1.5 text-xs text-ink-500">{formatWeek(value, weekEndOf(value))}</p>
    </div>
  )
}
