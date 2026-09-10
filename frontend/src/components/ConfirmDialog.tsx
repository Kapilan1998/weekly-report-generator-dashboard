import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'

/**
 * A small modal that asks before doing something irreversible.
 *
 * <h2>Why not the native `<dialog>` element</h2>
 * It was built on `<dialog>` first, for the focus trap and top-layer rendering that
 * `showModal()` gives for free. Two problems in a row made it the wrong choice here:
 *
 * 1. A modal `<dialog>` is centred solely by the UA stylesheet's `margin: auto`, which
 *    Tailwind's preflight overrides with `margin: 0` — so it opened in the top-left corner.
 * 2. Worse, `showModal()` did not reliably take effect, which left the element visible but
 *    *not modal*: no backdrop, and `close()` with nothing to close. The dialog got stuck open
 *    after a delete, and since the selection had been cleared by then it read "Delete 0
 *    drafts?".
 *
 * The second one is the real argument. It put the browser's open/closed state and React's
 * `open` prop in charge of the same thing, and they drifted. Here the component simply
 * **returns null when closed**, so "stuck open" cannot happen: closing is an unmount.
 *
 * <h2>Rendered through a portal</h2>
 * Same reason as `WeekField`: this opens from inside a `Card`, which sets `overflow-hidden`,
 * under a section that `animate-fade-up` leaves a settled `transform` on. A transformed
 * ancestor becomes the containing block for `position: fixed`, so even fixed positioning
 * would be trapped and clipped inside the card. A portal to `document.body` has neither
 * ancestor.
 *
 * <h2>Focus starts on the cancel button</h2>
 * Deliberate, and the opposite of what feels natural. The action behind this dialog cannot be
 * undone, so a stray Enter — from a keyboard user who has not read it yet, or the keypress
 * that opened the dialog repeating — must not carry it out. Confirming is one Tab away.
 */
interface ConfirmDialogProps {
  open: boolean
  title: string
  /** The consequence, in one or two sentences. Say what will be lost, not just "are you sure". */
  children: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` for anything destructive; `primary` for a merely significant confirmation. */
  tone?: 'danger' | 'primary'
  /** Blocks both buttons and every dismiss path while the action is in flight. */
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel = 'Yes',
  cancelLabel = 'No',
  tone = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Closed means not rendered. Every "it won't close" bug in a modal comes from the thing
  // being present but hidden, with two sources of truth for whether it is showing.
  if (!open) return null

  return (
    <DialogBody
      title={title}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      tone={tone}
      loading={loading}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      {children}
    </DialogBody>
  )
}

/**
 * Split out so the effects below mount and unmount with the dialog itself. Hooks cannot sit
 * after the early return above, and gating each one on `open` would leave the listeners
 * attached for the whole life of the page.
 */
function DialogBody({
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone,
  loading,
  onConfirm,
  onCancel,
}: Omit<ConfirmDialogProps, 'open'>) {
  const panelRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Remembered before focus moves, so it can go back to the button that opened this.
    const previouslyFocused = document.activeElement as HTMLElement | null
    cancelRef.current?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        // Not while the request is running: dismissing mid-delete would leave the user not
        // knowing whether it went through.
        if (!loading) onCancel()
        return
      }

      // A focus trap, hand-rolled because the native dialog is no longer doing it. Tab must
      // not reach the page behind, where the row that opened this is still clickable.
      if (event.key !== 'Tab') return
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusable || focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [loading, onCancel])

  useEffect(() => {
    // The page behind must not scroll under the dialog. The previous value is restored rather
    // than cleared, so this composes with anything else that locks scrolling.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      // z-50 clears the assistant widget (z-40) and the week-picker popover (z-50 but never
      // open at the same time). Centred by this element, not by any UA rule.
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-navy-950/70 p-4"
      onClick={(event) => {
        // Only a click on this backdrop element itself is "outside" — a click on the panel
        // targets the panel and stops here without matching.
        if (event.target === event.currentTarget && !loading) onCancel()
      }}
    >
      <div
        ref={panelRef}
        className="max-h-full w-[22rem] max-w-full overflow-y-auto rounded-xl bg-navy-800 p-5 shadow-2xl shadow-black/60 ring-1 ring-white/10"
      >
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className={`grid size-9 shrink-0 place-items-center rounded-full ${
              tone === 'danger'
                ? 'bg-red-500/15 text-red-300 ring-1 ring-red-500/30'
                : 'bg-brand-500/15 text-brand-300 ring-1 ring-brand-400/30'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.5v5m0 3h.01M12 3.5 2.5 20h19L12 3.5Z" />
            </svg>
          </span>
          <div className="min-w-0">
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-ink-100">
              {title}
            </h2>
            <div className="mt-1 text-sm leading-relaxed text-ink-300">{children}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={tone} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
