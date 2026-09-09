import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { Button } from '../components/Button'
import { Card } from '../components/Card'

/**
 * The page a wrong URL lands on.
 *
 * It renders inside the app shell, so the person seeing it is always signed in and still has
 * the navigation beside them. That shapes what belongs here: not an apology for a broken
 * site, but three useful things - what was asked for, the reassurance that nothing was lost,
 * and somewhere sensible to go next.
 *
 * The attempted path is shown deliberately. Most 404s in an app like this come from a stale
 * bookmark or a mistyped report id, and seeing `/reports/9999` is what tells you which.
 *
 * The destinations offered follow the role, matching the rule the rest of the app uses: a
 * team member is never shown a manager-only link, because ProtectedRoute would bounce them
 * straight back and the second dead end would be worse than the first.
 */
export function NotFoundPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { isManager } = useAuth()

  /*
   * React Router labels the first entry in the history stack 'default'. If that is where we
   * are, the URL was typed or opened from a bookmark, so there is no in-app page behind us
   * and the button would eject them from the application entirely. It is hidden rather than
   * disabled: a control that cannot do anything is better absent than greyed out.
   */
  const canGoBack = location.key !== 'default'

  return (
    // Centred in the content area rather than pinned to the top. A small card under a
    // full-height empty page reads as a broken layout, which is the opposite of reassuring.
    <section className="relative grid animate-fade-up place-items-center py-6 lg:min-h-[calc(100svh-9rem)]">
      {/* Decorative only. Same drifting-orb treatment as the sign-in panel, tinted brand
          rather than emerald because the surface behind it here is blue. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 size-80 -translate-x-1/2 animate-glow-drift rounded-full bg-brand-500/25 blur-3xl"
      />

      <div className="relative w-full max-w-lg">
        <Card>
          <div className="px-6 py-10 text-center sm:px-10">
            <div
              aria-hidden="true"
              className="mx-auto grid size-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-300 ring-1 ring-brand-400/20"
            >
              {/* One shape, not two. An earlier version overlapped a document and a
                  magnifier, which at this size resolved into a smudge - a single glyph is
                  the only thing that stays legible in a 32px box. The domain reference is
                  carried by the copy instead. */}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                className="size-8"
              >
                <circle cx="10.5" cy="10.5" r="6.75" />
                <path strokeLinecap="round" d="M7.75 10.5h5.5M15.4 15.4 20 20" />
              </svg>
            </div>

            <p className="mt-6 bg-gradient-to-b from-brand-200 to-brand-600 bg-clip-text text-6xl font-bold tracking-tight text-transparent drop-shadow-[0_0_28px_rgb(124_109_247/0.35)]">
              404
            </p>

            <h1 className="mt-3 text-xl font-semibold tracking-tight text-ink-100">
              We couldn&apos;t find that page
            </h1>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-300">
              Every week has a report, but this address isn&apos;t one of them. The link may
              have gone out of date, or a character may have slipped into the URL.
            </p>

            {/* break-all, because a mistyped path can be one long token with nothing to
                wrap on - without it a single bad segment pushes the card wider than a
                phone screen. */}
            <p className="mt-4 text-xs text-ink-500">
              You asked for{' '}
              <code className="rounded bg-navy-900/70 px-1.5 py-0.5 font-mono break-all text-ink-300 ring-1 ring-inset ring-white/5">
                {location.pathname}
              </code>
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
              <Link
                to="/reports"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-950/40 transition duration-150 hover:bg-brand-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400 active:scale-[0.98]"
              >
                Back to my reports
              </Link>
              {canGoBack && (
                <Button variant="secondary" onClick={() => navigate(-1)}>
                  Go back
                </Button>
              )}
            </div>

            <p className="mt-6 border-t border-white/5 pt-5 text-xs leading-relaxed text-ink-500">
              Nothing has been lost — every report is still exactly where you left it.
              {isManager ? (
                <>
                  {' '}
                  You can also open the{' '}
                  <Link
                    to="/team"
                    className="font-medium text-brand-300 underline decoration-brand-400/40 underline-offset-2 transition hover:text-brand-200 hover:decoration-brand-300"
                  >
                    team dashboard
                  </Link>{' '}
                  or{' '}
                  <Link
                    to="/projects"
                    className="font-medium text-brand-300 underline decoration-brand-400/40 underline-offset-2 transition hover:text-brand-200 hover:decoration-brand-300"
                  >
                    projects
                  </Link>
                  .
                </>
              ) : (
                <>
                  {' '}
                  Ready to file this week&apos;s?{' '}
                  <Link
                    to="/reports/new"
                    className="font-medium text-brand-300 underline decoration-brand-400/40 underline-offset-2 transition hover:text-brand-200 hover:decoration-brand-300"
                  >
                    Start a new report
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        </Card>
      </div>
    </section>
  )
}
