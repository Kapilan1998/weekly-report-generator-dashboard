import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { TextField } from './TextField'

/**
 * A password field with a show/hide toggle.
 *
 * Takes everything `TextField` does except `type` and `trailing`, which it owns — the whole
 * point is that the type follows the toggle, so letting a caller set it would break the
 * control.
 *
 * Two details that are easy to get wrong and matter here:
 *
 * - `type="button"`. Inside a form, a button with no type is a submit button, so tapping the
 *   eye would post the login form with a half-typed password.
 * - The visible state is announced. A sighted user can see whether the characters are masked,
 *   but a screen-reader user cannot, so the accessible name changes with the state and
 *   `aria-pressed` carries it as well.
 *
 * It resets to hidden on every mount, deliberately. Remembering the choice across pages would
 * mean a password left in plain text on a screen the user has walked away from.
 */

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string
  error?: string
  hint?: string
}

export function PasswordField({ label, error, hint, ...rest }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false)

  return (
    <TextField
      {...rest}
      label={label}
      error={error}
      hint={hint}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          className="grid size-8 place-items-center rounded-md text-ink-500 transition hover:bg-white/5 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  )
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
      className="size-4"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12S18 18.25 12 18.25 2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="3.25" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      aria-hidden="true"
      className="size-4"
    >
      {/* The same eye, struck through - the conventional "hidden" glyph, and legible at 16px
          in a way a redrawn broken-eye outline is not. */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12S18 18.25 12 18.25 2.5 12 2.5 12Z"
      />
      <circle cx="12" cy="12" r="3.25" />
      <path strokeLinecap="round" d="M4 20 20 4" />
    </svg>
  )
}
