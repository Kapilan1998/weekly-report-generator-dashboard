import type { ReactNode } from 'react'

/**
 * The small action button used in the admin list rows — Projects and User management.
 *
 * Shared rather than duplicated: both pages had their own copy, and once each action wanted
 * its own hover colour that meant maintaining the same tone table twice.
 *
 * <h2>Quiet until hovered</h2>
 * Every tone renders in the same muted grey and only reveals its colour on hover. A row of
 * permanently coloured buttons reads as decoration and makes the whole list shout; the colour
 * here is feedback about what you are about to do, at the moment you are about to do it.
 *
 * The tones reuse meanings the app already carries elsewhere, so there is nothing new to
 * learn: violet for an ordinary action, amber for taking something out of service, emerald for
 * putting it back, red for destroying it. A toggle button — Deactivate/Activate,
 * Disable/Enable — should pass the tone that matches its current *label*, not a fixed one.
 */
export type RowButtonTone = 'neutral' | 'edit' | 'retire' | 'restore' | 'danger'

const TONES: Record<RowButtonTone, string> = {
  neutral: 'text-ink-300 ring-white/10 hover:bg-white/5 hover:text-ink-100',
  edit: 'text-ink-300 ring-white/10 hover:bg-brand-500/15 hover:text-brand-200 hover:ring-brand-400/30',
  retire: 'text-ink-300 ring-white/10 hover:bg-amber-500/15 hover:text-amber-200 hover:ring-amber-400/30',
  restore:
    'text-ink-300 ring-white/10 hover:bg-emerald-500/15 hover:text-emerald-200 hover:ring-emerald-400/30',
  // The one exception to "quiet until hovered": a delete button carries its warning before
  // you reach it, not after.
  danger: 'text-red-300 ring-red-500/25 hover:bg-red-500/15 hover:text-red-200 hover:ring-red-400/40',
}

export function RowButton({
  children,
  onClick,
  disabled,
  tone = 'neutral',
  title,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: RowButtonTone
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone]}`}
    >
      {children}
    </button>
  )
}
