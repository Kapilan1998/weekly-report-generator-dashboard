import { TextAreaField } from '../../components/TextAreaField'
import { emptyFlaggableRow } from './reportFormState'
import type { FlaggableRowState } from './reportFormState'

/**
 * A repeatable list where at most one row can be flagged — used verbatim for both blockers
 * ("key issue for the week") and achievements ("key achievement for the week"), which are
 * structurally the same control with different words.
 *
 * The flag is a radio group rather than per-row checkboxes, so the backend's
 * "only one may be flagged" rule is impossible to violate rather than merely validated. A
 * radio can't be unset by clicking it again, so an explicit "Clear" is provided — a week
 * with no standout blocker has to remain expressible.
 */
interface FlaggableListProps {
  legend: string
  description: string
  flagLabel: string
  addLabel: string
  placeholder: string
  radioName: string
  rowPrefix: string
  rows: FlaggableRowState[]
  error?: string
  disabled?: boolean
  onChange: (rows: FlaggableRowState[]) => void
}

export function FlaggableList({
  legend,
  description,
  flagLabel,
  addLabel,
  placeholder,
  radioName,
  rowPrefix,
  rows,
  error,
  disabled = false,
  onChange,
}: FlaggableListProps) {
  function updateRow(index: number, patch: Partial<FlaggableRowState>) {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
  }

  function flagOnly(index: number) {
    onChange(rows.map((row, i) => ({ ...row, flagged: i === index })))
  }

  function clearFlag() {
    onChange(rows.map((row) => ({ ...row, flagged: false })))
  }

  const hasFlag = rows.some((row) => row.flagged)

  return (
    <fieldset>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <legend className="text-sm font-semibold text-ink-100">{legend}</legend>
          <p className="text-xs text-ink-500">{description}</p>
        </div>
        {error && <p className="text-xs font-medium text-red-300">{error}</p>}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg bg-navy-900/40 px-3.5 py-3 text-sm text-ink-500 ring-1 ring-inset ring-white/5">
          Nothing added — leave empty if there were none this week.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.key}
              className="rounded-lg bg-navy-900/40 p-3 ring-1 ring-inset ring-white/5"
            >
              <TextAreaField
                label={`${legend} ${index + 1}`}
                labelHidden
                rows={2}
                maxLength={1000}
                placeholder={placeholder}
                value={row.description}
                disabled={disabled}
                onChange={(event) => updateRow(index, { description: event.target.value })}
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-300">
                  <input
                    type="radio"
                    name={radioName}
                    checked={row.flagged}
                    disabled={disabled}
                    onChange={() => flagOnly(index)}
                    className="size-3.5 accent-amber-400"
                  />
                  {flagLabel}
                </label>
                <button
                  type="button"
                  onClick={() => onChange(rows.filter((_, i) => i !== index))}
                  disabled={disabled}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-40"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onChange([...rows, emptyFlaggableRow(rowPrefix)])}
          disabled={disabled || rows.length >= 20}
          className="rounded-lg px-3 py-2 text-sm font-medium text-brand-300 transition hover:bg-brand-500/10 hover:text-brand-200 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {addLabel}
        </button>
        {hasFlag && (
          <button
            type="button"
            onClick={clearFlag}
            disabled={disabled}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink-500 transition hover:bg-white/5 hover:text-ink-300"
          >
            Clear {flagLabel.toLowerCase()}
          </button>
        )}
      </div>
    </fieldset>
  )
}
