import type { TextareaHTMLAttributes } from 'react'

interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  labelHidden?: boolean
  error?: string
  hint?: string
  /** Shows a live character count once the value approaches maxLength. */
  showCount?: boolean
}

export function TextAreaField({
  label,
  labelHidden = false,
  error,
  hint,
  showCount = false,
  id,
  className = '',
  maxLength,
  value,
  ...rest
}: TextAreaFieldProps) {
  const areaId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  const describedBy = error ? `${areaId}-error` : hint ? `${areaId}-hint` : undefined
  const length = typeof value === 'string' ? value.length : 0
  // Only worth showing when the limit is actually in reach.
  const countVisible = showCount && maxLength !== undefined && length > maxLength * 0.8

  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={areaId}
          className={labelHidden ? 'sr-only' : 'block text-sm font-medium text-ink-300'}
        >
          {label}
        </label>
        {countVisible && (
          <span className="text-xs text-ink-500">
            {length} / {maxLength}
          </span>
        )}
      </div>
      <textarea
        {...rest}
        id={areaId}
        value={value}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`block w-full rounded-lg bg-navy-900/70 px-3.5 py-2.5 text-sm text-ink-100 ring-1 ring-inset transition placeholder:text-ink-500 focus:bg-navy-900 focus:ring-2 focus:ring-inset focus:outline-none ${
          labelHidden ? '' : 'mt-1.5'
        } ${
          error
            ? 'ring-red-500/50 focus:ring-red-400'
            : 'ring-white/10 hover:ring-white/20 focus:ring-brand-400'
        }`}
      />
      {error ? (
        <p id={`${areaId}-error`} className="mt-1.5 text-xs font-medium text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${areaId}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
