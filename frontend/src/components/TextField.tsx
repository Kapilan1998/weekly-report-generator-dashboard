import type { InputHTMLAttributes, ReactNode } from 'react'

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  /** Keeps the label for screen readers while a table header carries the visible one. */
  labelHidden?: boolean
  /** Field-level message from the backend's fieldErrors, or from client-side validation. */
  error?: string
  hint?: string
  /**
   * A control rendered inside the field, against its right edge — currently the password
   * visibility toggle in {@link PasswordField}.
   *
   * The wrapper it needs is only added when something is actually passed, so every existing
   * field keeps exactly the DOM it had. That matters more than the tidier unconditional
   * version: this component is used in roughly thirty places, and an extra element in the
   * flow of all of them to serve two is a poor trade.
   */
  trailing?: ReactNode
}

export function TextField({
  label,
  labelHidden = false,
  error,
  hint,
  trailing,
  id,
  className = '',
  onWheel,
  ...rest
}: TextFieldProps) {
  const inputId = id ?? rest.name ?? label.toLowerCase().replace(/\s+/g, '-')
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
  const spacing = labelHidden ? '' : 'mt-1.5'

  /**
   * A focused `type="number"` input treats the mouse wheel as increment/decrement, so simply
   * scrolling the page with the pointer over one silently rewrites the value — and on a form
   * like the task table, where several sit in a row, the number that changed is not the one
   * you were looking at. Every numeric field in this app goes through this component, so
   * handling it here covers all of them.
   *
   * Blurring rather than preventing the event, for two reasons. React registers `wheel` as a
   * *passive* listener on the root, so `preventDefault()` inside `onWheel` is ignored — the
   * fix would silently not work. And even where it did work it would swallow the scroll, so
   * the page would freeze whenever the pointer crossed a number field, which is worse than
   * the bug. Blurring hands the gesture back to the page: the value stops changing and the
   * scroll behaves normally.
   *
   * Arrow keys are deliberately left alone. Up/Down on a focused number input is a
   * deliberate keystroke, not a side effect of trying to do something else.
   */
  function handleWheel(event: React.WheelEvent<HTMLInputElement>) {
    if (rest.type === 'number' && event.currentTarget === document.activeElement) {
      event.currentTarget.blur()
    }
    onWheel?.(event)
  }

  const input = (
    <input
      {...rest}
      id={inputId}
      onWheel={handleWheel}
      aria-invalid={error ? true : undefined}
      aria-describedby={describedBy}
      // Inputs are recessed (darker than the card) rather than raised, which reads
      // correctly on a dark surface.
      //
      // pr-11 when there is a trailing control, so a long value scrolls under the label
      // rather than under the button.
      className={`block w-full rounded-lg bg-navy-900/70 py-2.5 pl-3.5 text-sm text-ink-100 ring-1 ring-inset transition placeholder:text-ink-500 focus:bg-navy-900 focus:ring-2 focus:ring-inset focus:outline-none ${
        trailing ? 'pr-11' : 'pr-3.5'
      } ${
        // The margin moves to the wrapper when there is one: left on the input it would
        // offset the input inside the wrapper and leave the absolute button 6px high.
        trailing ? '' : spacing
      } ${
        error
          ? 'ring-red-500/50 focus:ring-red-400'
          : 'ring-white/10 hover:ring-white/20 focus:ring-brand-400'
      }`}
    />
  )

  return (
    <div className={className}>
      <label
        htmlFor={inputId}
        className={labelHidden ? 'sr-only' : 'block text-sm font-medium text-ink-300'}
      >
        {label}
      </label>

      {trailing ? (
        <div className={`relative ${spacing}`}>
          {input}
          <span className="absolute inset-y-0 right-0 flex items-center pr-1.5">{trailing}</span>
        </div>
      ) : (
        input
      )}

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
