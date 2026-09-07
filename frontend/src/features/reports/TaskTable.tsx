import { SelectField } from '../../components/SelectField'
import { TextField } from '../../components/TextField'
import { TASK_PRIORITIES, TASK_WORK_STATUSES, emptyTaskRow } from './reportFormState'
import type { FieldErrors, TaskRowState } from './reportFormState'

/**
 * The task-level table the brief mandates.
 *
 * Column order follows the PDF exactly — name, priority, planned %, actual %, status, time
 * planned, time spent, output — which is NOT the declaration order of the TaskEntry type.
 * The brief bolds "the same set of fields, in the same order", and each "X vs Y" pair is two
 * separate columns, never one combined cell.
 */
function humanize(value: string): string {
  const lower = value.toLowerCase().replace(/_/g, ' ')
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

interface TaskTableProps {
  rows: TaskRowState[]
  errors: FieldErrors
  disabled?: boolean
  onChange: (rows: TaskRowState[]) => void
}

export function TaskTable({ rows, errors, disabled = false, onChange }: TaskTableProps) {
  function updateRow(index: number, patch: Partial<TaskRowState>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index))
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink-100">Tasks completed</h2>
          <p className="text-xs text-ink-500">
            What you finished this week. At least one task is required to submit.
          </p>
        </div>
        {errors.tasks && <p className="text-xs font-medium text-red-300">{errors.tasks}</p>}
      </div>

      {/* Eight columns cannot fit a phone, so the table scrolls inside its own container
          rather than forcing the page to scroll sideways. */}
      <div className="overflow-x-auto rounded-lg ring-1 ring-white/10">
        <table className="min-w-[56rem] border-collapse text-sm">
          <thead className="bg-navy-700/50 text-left text-xs font-semibold tracking-wide text-ink-500 uppercase">
            <tr>
              <th className="px-3 py-2.5 font-semibold">Task name</th>
              <th className="px-3 py-2.5 font-semibold">Priority</th>
              <th className="px-3 py-2.5 font-semibold">Planned %</th>
              <th className="px-3 py-2.5 font-semibold">Actual %</th>
              <th className="px-3 py-2.5 font-semibold">Status</th>
              <th className="px-3 py-2.5 font-semibold">Time planned (h)</th>
              <th className="px-3 py-2.5 font-semibold">Time spent (h)</th>
              <th className="px-3 py-2.5 font-semibold">Output / deliverable</th>
              <th className="px-3 py-2.5">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row, index) => (
              // Keyed by a client-generated id: the backend replaces child rows on every
              // save, so a server id would change each time and remount the row.
              <tr key={row.key} className="align-top">
                <td className="min-w-56 px-3 py-2">
                  <TextField
                    label={`Task name, row ${index + 1}`}
                    name={`task-${index}-taskName`}
                    labelHidden
                    value={row.taskName}
                    disabled={disabled}
                    maxLength={255}
                    error={errors[`tasks.${index}.taskName`]}
                    onChange={(event) => updateRow(index, { taskName: event.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <SelectField
                    label={`Priority, row ${index + 1}`}
                    name={`task-${index}-priority`}
                    labelHidden
                    value={row.priority}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(index, { priority: event.target.value as TaskRowState['priority'] })
                    }
                  >
                    {TASK_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {humanize(priority)}
                      </option>
                    ))}
                  </SelectField>
                </td>
                <td className="w-28 px-3 py-2">
                  <TextField
                    label={`Planned percent, row ${index + 1}`}
                    name={`task-${index}-plannedPercent`}
                    labelHidden
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={row.plannedPercent}
                    disabled={disabled}
                    error={errors[`tasks.${index}.plannedPercent`]}
                    onChange={(event) => updateRow(index, { plannedPercent: event.target.value })}
                  />
                </td>
                <td className="w-28 px-3 py-2">
                  <TextField
                    label={`Actual percent, row ${index + 1}`}
                    name={`task-${index}-actualPercent`}
                    labelHidden
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={100}
                    step={1}
                    value={row.actualPercent}
                    disabled={disabled}
                    error={errors[`tasks.${index}.actualPercent`]}
                    onChange={(event) => updateRow(index, { actualPercent: event.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <SelectField
                    label={`Status, row ${index + 1}`}
                    name={`task-${index}-status`}
                    labelHidden
                    value={row.status}
                    disabled={disabled}
                    onChange={(event) =>
                      updateRow(index, { status: event.target.value as TaskRowState['status'] })
                    }
                  >
                    {TASK_WORK_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {humanize(status)}
                      </option>
                    ))}
                  </SelectField>
                </td>
                <td className="w-32 px-3 py-2">
                  <TextField
                    label={`Time planned, row ${index + 1}`}
                    name={`task-${index}-timePlannedHours`}
                    labelHidden
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={999.99}
                    step={0.25}
                    value={row.timePlannedHours}
                    disabled={disabled}
                    error={errors[`tasks.${index}.timePlannedHours`]}
                    onChange={(event) => updateRow(index, { timePlannedHours: event.target.value })}
                  />
                </td>
                <td className="w-32 px-3 py-2">
                  <TextField
                    label={`Time spent, row ${index + 1}`}
                    name={`task-${index}-timeSpentHours`}
                    labelHidden
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={999.99}
                    step={0.25}
                    value={row.timeSpentHours}
                    disabled={disabled}
                    error={errors[`tasks.${index}.timeSpentHours`]}
                    onChange={(event) => updateRow(index, { timeSpentHours: event.target.value })}
                  />
                </td>
                <td className="min-w-56 px-3 py-2">
                  <TextField
                    label={`Output or deliverable, row ${index + 1}`}
                    name={`task-${index}-outputDeliverable`}
                    labelHidden
                    value={row.outputDeliverable}
                    disabled={disabled}
                    maxLength={500}
                    error={errors[`tasks.${index}.outputDeliverable`]}
                    onChange={(event) => updateRow(index, { outputDeliverable: event.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeRow(index)}
                    disabled={disabled}
                    aria-label={`Remove task row ${index + 1}`}
                    className="grid size-8 place-items-center rounded-lg text-ink-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      aria-hidden="true"
                      className="size-4"
                    >
                      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-sm text-ink-500">
                  No tasks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => onChange([...rows, emptyTaskRow()])}
        disabled={disabled || rows.length >= 50}
        className="mt-2 rounded-lg px-3 py-2 text-sm font-medium text-brand-300 transition hover:bg-brand-500/10 hover:text-brand-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Add task
      </button>
    </div>
  )
}
