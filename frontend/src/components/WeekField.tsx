import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatWeekCompact } from '../lib/format'
import {
  addDaysIso,
  addMonthsIso,
  mondayOf,
  parseIsoDate,
  todayIso,
  toIsoDate,
  weekEndOf,
} from '../lib/week'

/**
 * A week picker, replacing `<input type="date">` everywhere this app chooses a week.
 *
 * <h2>Why a custom control rather than styling the native one</h2>
 * Chrome's date popup is painted by the browser outside the document, so no stylesheet can
 * reach it — on a dark page it opens as a white panel using the browser's own blue. It also
 * offers a *day*, and every one of these fields wants a *week*: all four callers piped the
 * value through `mondayOf` and threw the day away.
 *
 * So this control picks what the application actually stores. Each row is one week: hovering
 * lights the whole Monday–Sunday row, clicking anywhere in it selects that week, and the
 * selected week stays highlighted as a row. The snapping the native input hid behind a silent
 * normalisation is now the visible behaviour of the widget.
 *
 * <h2>Rendered through a portal</h2>
 * Not for stacking order but for clipping. `Card` sets `overflow-hidden` for its rounded
 * corners, and `animate-fade-up` leaves a settled `transform` on the section wrapper — a
 * transformed ancestor becomes the containing block for `position: fixed`, so even fixed
 * positioning would be trapped and clipped inside the card. A portal to `document.body` has
 * neither ancestor, which is the only arrangement that reliably escapes both.
 */

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/** Six rows always, so moving between months never changes the popover's height. */
const WEEKS_SHOWN = 6

interface WeekFieldProps {
  label: string
  /** '' or a yyyy-MM-dd Monday. Anything else is snapped on the way in. */
  value: string
  onChange: (mondayIso: string) => void
  labelHidden?: boolean
  /** Offers "Any week" and a Clear action — for filters, where empty is a real choice. */
  clearable?: boolean
  placeholder?: string
  error?: string
  hint?: string
  id?: string
  className?: string
  /** Width of the trigger; the popover sizes itself independently. */
  triggerClassName?: string
  /**
   * `recessed` matches `TextField` on a card — darker than the surface behind it, which is
   * how an input reads on a dark theme. `raised` matches the selects in a page header, which
   * sit directly on the page background and would disappear if they were darker than it.
   */
  surface?: 'recessed' | 'raised'
  /** `md` matches a form field, `sm` the denser controls in a filter row or page header. */
  size?: 'md' | 'sm'
  /** For callers whose labels follow a different convention, e.g. the filter row's caps. */
  labelClassName?: string
}

/*
 * Surface and padding are separate variants rather than one combined class, because they
 * vary independently: the filter row is recessed *and* dense, the page header is raised and
 * dense, a form field is recessed and roomy. They are variants at all - rather than
 * something a caller overrides through triggerClassName - because two competing Tailwind
 * paddings in one class string are resolved by stylesheet order, not attribute order, so an
 * override would win or lose unpredictably.
 */
const SURFACES: Record<'recessed' | 'raised', string> = {
  recessed: 'bg-navy-900/70 focus:bg-navy-900',
  raised: 'bg-navy-800',
}

const SIZES: Record<'md' | 'sm', string> = {
  md: 'px-3.5 py-2.5',
  sm: 'px-3 py-2',
}

export function WeekField({
  label,
  value,
  onChange,
  labelHidden = false,
  clearable = false,
  placeholder = 'Pick a week',
  error,
  hint,
  id,
  className = '',
  triggerClassName = 'w-full',
  surface = 'recessed',
  size = 'md',
  labelClassName = 'block text-sm font-medium text-ink-300',
}: WeekFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, '-')
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const selectedMonday = value ? mondayOf(value) : ''
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined

  function choose(mondayIso: string) {
    onChange(mondayIso)
    setOpen(false)
    // Focus goes back to the trigger. Without it a keyboard user is left with nothing
    // focused and has to Tab in from the top of the document again.
    triggerRef.current?.focus()
  }

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  return (
    <div className={className}>
      <span
        id={`${fieldId}-label`}
        className={labelHidden ? 'sr-only' : labelClassName}
      >
        {label}
      </span>

      <button
        ref={triggerRef}
        type="button"
        id={fieldId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          // Down-arrow opens, which is what every native select and combobox does.
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            setOpen(true)
          }
        }}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-labelledby={`${fieldId}-label`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        // Recessed like TextField's input, so a week field and a text field read as the
        // same kind of control on the same form.
        className={`flex items-center gap-2 rounded-lg text-left text-sm ring-1 ring-inset transition focus:outline-none ${SURFACES[surface]} ${SIZES[size]} ${triggerClassName} ${
          labelHidden ? '' : 'mt-1.5'
        } ${
          error
            ? 'ring-red-500/50 focus:ring-2 focus:ring-inset focus:ring-red-400'
            : open
              ? 'ring-2 ring-brand-400'
              : 'ring-white/10 hover:ring-white/20 focus:ring-2 focus:ring-inset focus:ring-brand-400'
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          aria-hidden="true"
          className="size-4 shrink-0 text-ink-500"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 3.5v3m10-3v3M4 9.5h16M6 6h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Z"
          />
        </svg>
        <span
          className={`min-w-0 flex-1 truncate ${selectedMonday ? 'text-ink-100' : 'text-ink-500'}`}
        >
          {selectedMonday
            ? formatWeekCompact(selectedMonday, weekEndOf(selectedMonday))
            : clearable
              ? 'Any week'
              : placeholder}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
          className={`size-3.5 shrink-0 text-ink-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {error ? (
        <p id={`${fieldId}-error`} className="mt-1.5 animate-fade-in text-xs font-medium text-red-300">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-ink-500">
          {hint}
        </p>
      ) : null}

      {open && (
        <WeekCalendarPopover
          anchor={triggerRef}
          label={label}
          selectedMonday={selectedMonday}
          clearable={clearable}
          onSelect={choose}
          onClose={close}
        />
      )}
    </div>
  )
}

interface PopoverProps {
  anchor: React.RefObject<HTMLButtonElement | null>
  label: string
  selectedMonday: string
  clearable: boolean
  onSelect: (mondayIso: string) => void
  onClose: () => void
}

/** First day of the six-week grid that shows the month containing `isoInMonth`. */
function gridStartFor(isoInMonth: string): string {
  const date = parseIsoDate(isoInMonth) ?? new Date()
  return mondayOf(toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1)))
}

function WeekCalendarPopover({
  anchor,
  label,
  selectedMonday,
  clearable,
  onSelect,
  onClose,
}: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const today = todayIso()
  const openingWeek = selectedMonday || mondayOf(today)

  /*
   * Two pieces of state, not one.
   *
   * Deriving the visible month from the focused week looks tempting and is wrong: stepping a
   * month back from 3 Oct gives 3 Sep, whose Monday is 31 Aug, so the grid would jump to
   * August and skip September entirely. They have to move independently, with the rule below
   * keeping the focused week on screen.
   */
  const [visibleMonth, setVisibleMonth] = useState(openingWeek)
  const [focusedWeek, setFocusedWeek] = useState(openingWeek)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  /*
   * Measuring and the listeners that re-measure live in one layout effect on purpose.
   * Hoisting `place` into a `useCallback` reads `anchor.current` while declaring `[anchor]`
   * as the dependency, and the React Compiler refuses to preserve that memoization - it is
   * a real mismatch, since the ref's contents change without the ref identity changing.
   * Declared inside the effect, there is no memoization to get wrong.
   *
   * A layout effect rather than a plain one so the measurement lands before paint: the panel
   * starts off-screen and would otherwise be visible there for a frame.
   */
  useLayoutEffect(() => {
    function place() {
      const trigger = anchor.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const panelHeight = panelRef.current?.offsetHeight ?? 360
      const panelWidth = panelRef.current?.offsetWidth ?? 296

      // Flip above when there is no room below: a calendar that opens off the bottom of a
      // short viewport is worse than one that opens upward.
      const roomBelow = window.innerHeight - rect.bottom
      const top =
        roomBelow < panelHeight + 16 && rect.top > panelHeight + 16
          ? rect.top - panelHeight - 8
          : rect.bottom + 8

      // And keep it on screen horizontally, which the right-hand filter column needs.
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - panelWidth - 8),
      )

      setPosition({ top, left })
    }

    place()
    // Repositioned rather than reflowed: on scroll the trigger moves and a fixed panel does
    // not. Capture phase, so scrolling inside any container counts, not just the window.
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchor])

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || anchor.current?.contains(target)) return
      onClose()
    }
    // pointerdown, not click: closing on press matches every other menu, and avoids the
    // panel swallowing a click that was aimed at whatever is behind it.
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [anchor, onClose])

  // Moves DOM focus onto the focused week's row, on open and after every keyboard move.
  // A roving tabindex is what keeps the grid to one tab stop instead of six.
  useEffect(() => {
    panelRef.current
      ?.querySelector<HTMLButtonElement>(`[data-week="${focusedWeek}"]`)
      ?.focus({ preventScroll: true })
  }, [focusedWeek, visibleMonth])

  const gridStart = gridStartFor(visibleMonth)
  const weeks = Array.from({ length: WEEKS_SHOWN }, (_, index) => addDaysIso(gridStart, index * 7))
  const visibleMonthIndex = (parseIsoDate(visibleMonth) ?? new Date()).getMonth()

  /** Moves the focus by whole weeks, pulling the month along when it walks off the grid. */
  function moveWeeks(delta: number) {
    const next = addDaysIso(focusedWeek, delta * 7)
    if (!next) return
    setFocusedWeek(next)
    if (!weeks.includes(next)) setVisibleMonth(next)
  }

  function moveMonths(delta: number) {
    const nextMonth = addMonthsIso(visibleMonth, delta)
    if (!nextMonth) return
    setVisibleMonth(nextMonth)
    // Land on the first week of the month arrived at, so focus is always somewhere visible.
    setFocusedWeek(gridStartFor(nextMonth))
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    switch (event.key) {
      case 'Escape':
        event.preventDefault()
        onClose()
        return
      // A week is the unit of selection, so both "back" keys do the same thing. Moving by
      // single days would only change a value that is thrown away on the way out.
      case 'ArrowUp':
      case 'ArrowLeft':
        event.preventDefault()
        moveWeeks(-1)
        return
      case 'ArrowDown':
      case 'ArrowRight':
        event.preventDefault()
        moveWeeks(1)
        return
      case 'PageUp':
        event.preventDefault()
        moveMonths(-1)
        return
      case 'PageDown':
        event.preventDefault()
        moveMonths(1)
        return
      case 'Home':
        event.preventDefault()
        setVisibleMonth(mondayOf(today))
        setFocusedWeek(mondayOf(today))
        return
      default:
    }
  }

  const monthLabel = (parseIsoDate(visibleMonth) ?? new Date()).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  const navClass =
    'grid size-8 place-items-center rounded-lg text-ink-300 transition hover:bg-white/10 hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400'

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${label}: choose a week`}
      onKeyDown={handleKeyDown}
      // Only placed, never stretched. Matching the trigger's width would blow a calendar out
      // to the width of a form field and leave the cells swimming in space; a calendar has a
      // natural size, which is why every native picker keeps its own.
      style={
        position
          ? { top: position.top, left: position.left }
          : // Off-screen for the one frame before the layout effect measures it.
            { top: -9999, left: -9999 }
      }
      className="animate-fade-in fixed z-50 w-[18.5rem] rounded-xl bg-navy-800 p-3 shadow-2xl shadow-black/60 ring-1 ring-white/10"
    >
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <button type="button" onClick={() => moveMonths(-1)} aria-label="Previous month" className={navClass}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5l-5 5 5 5" />
          </svg>
        </button>
        <p aria-live="polite" className="text-sm font-semibold text-ink-100">
          {monthLabel}
        </p>
        <button type="button" onClick={() => moveMonths(1)} aria-label="Next month" className={navClass}>
          <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true" className="size-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8 5 5 5-5 5" />
          </svg>
        </button>
      </div>

      {/* Monday first, because a week here starts on Monday. A Sunday-first grid would split
          one report week across two rows, which is the one thing this control must not do. */}
      <div className="grid grid-cols-7 gap-0.5 px-0.5" aria-hidden="true">
        {WEEKDAYS.map((day) => (
          <span key={day} className="py-1 text-center text-[11px] font-semibold text-ink-500">
            {day}
          </span>
        ))}
      </div>

      <div className="mt-0.5 space-y-0.5">
        {weeks.map((weekStart) => {
          const isSelected = weekStart === selectedMonday
          return (
            <button
              key={weekStart}
              type="button"
              data-week={weekStart}
              // The whole row is one control, because a week is what gets picked. It also
              // makes the hover highlight plain CSS on this element - no mousemove state,
              // so dragging the pointer across the grid costs no renders at all.
              onClick={() => onSelect(weekStart)}
              tabIndex={weekStart === focusedWeek ? 0 : -1}
              aria-pressed={isSelected}
              aria-label={`Week of ${formatWeekCompact(weekStart, weekEndOf(weekStart))}`}
              className={`grid w-full grid-cols-7 gap-0.5 rounded-lg p-0.5 ring-inset transition focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-400 ${
                isSelected
                  ? 'bg-brand-600/30 ring-1 ring-brand-400/50'
                  : 'hover:bg-brand-500/15 hover:ring-1 hover:ring-brand-400/25'
              }`}
            >
              {Array.from({ length: 7 }, (_, offset) => {
                const dayIso = addDaysIso(weekStart, offset)
                const dayDate = parseIsoDate(dayIso)
                const inMonth = dayDate?.getMonth() === visibleMonthIndex
                const isToday = dayIso === today
                return (
                  <span
                    key={dayIso}
                    className={`grid h-8 place-items-center rounded-md text-[13px] tabular-nums ${
                      isSelected
                        ? 'font-semibold text-ink-100'
                        : inMonth
                          ? 'text-ink-300'
                          : // Leading and trailing days stay readable but clearly secondary,
                            // so the month's own boundaries are still legible.
                            'text-ink-500/60'
                    } ${
                      // Today keeps its marker in every state, so "which week is this one"
                      // is answerable without leaving the calendar.
                      isToday ? 'font-semibold text-brand-200 ring-1 ring-inset ring-brand-300/70' : ''
                    }`}
                  >
                    {dayDate?.getDate()}
                  </span>
                )
              })}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/5 px-1 pt-2">
        <button
          type="button"
          onClick={() => onSelect(mondayOf(today))}
          className="rounded-md px-2 py-1 text-xs font-semibold text-brand-300 transition hover:bg-brand-500/10 hover:text-brand-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
        >
          This week
        </button>
        {clearable && (
          <button
            type="button"
            onClick={() => onSelect('')}
            className="rounded-md px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-white/5 hover:text-ink-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
          >
            Clear
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}
