import { TextField } from '../../components/TextField'
import { TASK_TYPES } from './reportFormState'
import type { FieldErrors } from './reportFormState'
import type { TaskType } from '../../types/api'

const LABELS: Record<TaskType, string> = {
  DEVELOPMENT: 'Development',
  TESTING: 'Testing',
  MEETINGS: 'Meetings',
  DOCUMENTATION: 'Documentation',
  OTHER: 'Other',
}

/**
 * Hours worked by task type. The brief marks this optional to *fill in*, not optional to
 * build — it's also the only source for the required "time spent by task type" chart.
 *
 * A fixed row per task type rather than an add/remove repeater: the backend rejects a
 * duplicated task type, and a fixed grid makes that unreachable by construction.
 */
interface HoursGridProps {
  hours: Record<TaskType, string>
  errors: FieldErrors
  disabled?: boolean
  onChange: (hours: Record<TaskType, string>) => void
}

export function HoursGrid({ hours, errors, disabled = false, onChange }: HoursGridProps) {
  const total = TASK_TYPES.reduce((sum, type) => {
    const value = Number(hours[type])
    return sum + (Number.isFinite(value) ? value : 0)
  }, 0)

  return (
    <div>
      <h2 className="text-sm font-semibold text-ink-100">Hours by task type</h2>
      <p className="mb-2 text-xs text-ink-500">Optional. Leave a row blank if it doesn&apos;t apply.</p>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TASK_TYPES.map((type) => (
          <TextField
            key={type}
            label={LABELS[type]}
            name={`hours-${type.toLowerCase()}`}
            type="number"
            inputMode="decimal"
            min={0}
            max={999.99}
            step={0.25}
            placeholder="0"
            value={hours[type]}
            disabled={disabled}
            error={errors[`hours.${type}`]}
            onChange={(event) => onChange({ ...hours, [type]: event.target.value })}
          />
        ))}
      </div>

      <p className="mt-2 text-xs text-ink-500">
        Total: <span className="font-medium text-ink-300">{total.toFixed(2)} h</span>
      </p>
    </div>
  )
}
