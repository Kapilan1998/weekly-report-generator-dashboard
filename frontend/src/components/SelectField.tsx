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
        className={`block w-full rounded-lg bg-navy-900/70 px-3 py-2.5 text-sm text-ink-100 ring-1 ring-inset transition focus:bg-navy-900 focus:ring-2 focus:ring-inset focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 ${
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
