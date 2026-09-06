import { useLocation } from 'react-router-dom'
import { LoginForm } from '../features/auth/LoginForm'
import { RegisterForm } from '../features/auth/RegisterForm'

const HIGHLIGHTS = [
  'Structured weekly reports, identical for every team member',
  'Submit, get feedback, correct, resubmit — every version kept',
  'One dashboard across the whole team',
]

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
      className="mt-0.5 size-5 shrink-0 text-emerald-300"
    >
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 0 1 1.4-1.4l3.8 3.8 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

/**
 * Hosts both auth forms side by side and slides between them.
 *
 * Mounted by a layout route so it survives the /login <-> /register navigation — that is
 * what lets the transform animate instead of the whole screen being torn down and
 * remounted. The URL stays the single source of truth for which form is showing, so deep
 * links and the back button keep working.
 */
export function AuthPage() {
  const { pathname } = useLocation()
  const showRegister = pathname.startsWith('/register')

  return (
    <div className="flex min-h-svh flex-col bg-navy-900 lg:flex-row">
      {/* Brand panel: full height beside the form on desktop, a compact banner on mobile. */}
      {/* Deep emerald into teal, ending in indigo so the brand-coloured buttons on the form
          side still read as part of the same palette. */}
      <aside className="relative overflow-hidden border-b border-emerald-400/15 bg-gradient-to-br from-emerald-900 via-teal-900 to-brand-950 px-6 py-8 lg:w-[46%] lg:border-r lg:border-b-0 lg:px-12 lg:py-16">
        {/* Slow-drifting glows so the panel has depth and quiet movement. Transform and
            opacity only, so they stay on the compositor. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 -left-24 size-80 animate-glow-drift rounded-full bg-emerald-400/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -bottom-24 size-80 animate-glow-drift rounded-full bg-teal-300/15 blur-3xl [animation-delay:-8s]"
        />

        <div className="relative flex h-full flex-col">
          <div className="flex animate-fade-up items-center gap-2.5">
            {/* Neutral translucent chip rather than the indigo brand square, which would
                fight the green panel behind it. */}
            <span className="grid size-9 place-items-center rounded-lg bg-white/10 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur">
              WR
            </span>
            <span className="text-sm font-semibold tracking-tight text-ink-100">
              Weekly Reports
            </span>
          </div>

          <div className="mt-8 lg:mt-auto lg:mb-auto">
            <h2 className="animate-fade-up text-2xl font-semibold tracking-tight text-balance text-white [animation-delay:80ms] lg:text-3xl">
              Weekly reporting that managers actually read.
            </h2>
            <p className="mt-3 max-w-sm animate-fade-up text-sm text-ink-300 [animation-delay:160ms]">
              Team members file a consistent report each week. Managers review, request
              changes, and see the whole team in one place.
            </p>

            <ul className="mt-8 hidden space-y-3 text-sm text-ink-300 lg:block">
              {HIGHLIGHTS.map((item, index) => (
                <li
                  key={item}
                  className="flex animate-fade-up gap-2.5"
                  style={{ animationDelay: `${240 + index * 80}ms` }}
                >
                  <CheckIcon />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      {/* Form side */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md overflow-hidden">
          <div
            className={`flex w-[200%] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              showRegister ? '-translate-x-1/2' : 'translate-x-0'
            }`}
          >
            {/* inert keeps the off-screen form out of the tab order and the a11y tree. */}
            <div className="w-1/2" inert={showRegister} aria-hidden={showRegister}>
              <LoginForm />
            </div>
            <div className="w-1/2" inert={!showRegister} aria-hidden={!showRegister}>
              <RegisterForm />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
