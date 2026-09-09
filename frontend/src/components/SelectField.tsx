import type { ReactNode, SelectHTMLAttributes } from 'react'

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string
  /** Keeps the label for screen readers while a table header carries the visible one. */
  labelHidden?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

export function SelectField({
  label,
  labelHidden = false,
  error,
  hint,
  id,
  className = '',
  children,
  ...rest
}: SelectFieldProps) {
  const selectId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  const describedBy = error ? `${selectId}-error` : hint ? `${selectId}-hint` : undefined

  return (
    <div className={className}>
      <label
        htmlFor={selectId}
        className={labelHidden ? 'sr-only' : 'block text-sm font-medium text-ink-300'}
      >
        {label}
      </label>
      <select
        {...rest}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        // pr-9 rather than a symmetric px-3: the browser draws the dropdown arrow inside the
        // right padding, so 12px there leaves it sitting on top of the selected value. The
        // extra clearance is what makes the chosen option readable in a narrow column.
        //
        // truncate is the graceful-degradation half. A native select clips its text with no
        // ellipsis, so a column that ever gets tighter than its content shows a bare chevron
        // and looks broken rather than merely cramped.
        className={`block w-full truncate rounded-lg bg-navy-900/70 py-2.5 pl-3 pr-9 text-sm text-ink-100 ring-1 ring-inset transition focus:bg-navy-900 focus:ring-2 focus:ring-inset focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
          labelHidden ? '' : 'mt-1.5'
        } ${
          error
            ? 'ring-red-500/50 focus:ring-red-400'
            : 'ring-white/10 hover:ring-white/20 focus:ring-brand-400'
        }`}
      >
        {children}
      </select>
      {error ? (
        <p id={`${selectId}-error`} className="mt-1.5 text-xs font-medium text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${selectId}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
