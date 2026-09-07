import type { InputHTMLAttributes } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Keeps the label for screen readers while a table header carries the visible one. */
  labelHidden?: boolean
  /** Field-level message from the backend's fieldErrors, or from client-side validation. */
  error?: string
  hint?: string
}

export function TextField({
  label,
  labelHidden = false,
  error,
  hint,
  id,
  className = '',
  ...rest
}: TextFieldProps) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={labelHidden ? 'sr-only' : 'block text-sm font-medium text-ink-300'}
      >
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        // Inputs are recessed (darker than the card) rather than raised, which reads
        // correctly on a dark surface.
        className={`block w-full rounded-lg bg-navy-900/70 px-3.5 py-2.5 text-sm text-ink-100 ring-1 ring-inset transition placeholder:text-ink-500 focus:bg-navy-900 focus:ring-2 focus:ring-inset focus:outline-none ${
          labelHidden ? '' : 'mt-1.5'
        } ${
          error
            ? 'ring-red-500/50 focus:ring-red-400'
            : 'ring-white/10 hover:ring-white/20 focus:ring-brand-400'
        }`}
      />
      {error ? (
        <p id={`${inputId}-error`} className="mt-1.5 animate-fade-in text-xs font-medium text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
