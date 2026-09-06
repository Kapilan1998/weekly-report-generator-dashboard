import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'

function initials(name: string | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/** Account button in the top-right: avatar, name, chevron. Opens profile and sign out. */
export function UserMenu() {
  const { user, isManager, signOut } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // A menu has to close on outside click and on Escape, or it feels broken.
  useEffect(() => {
    if (!open) return

    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function go(path: string) {
    setOpen(false)
    navigate(path)
  }

  function handleSignOut() {
    setOpen(false)
    signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        // Sits inside the green top bar, so the trigger is toned for that background while
        // the panel below keeps the app's dark card styling.
        className={`flex items-center gap-2 rounded-lg py-1.5 pr-2 pl-1.5 text-sm transition ring-inset hover:bg-white/10 ${
          open ? 'bg-white/10 ring-1 ring-white/20' : ''
        }`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-semibold text-white ring-1 ring-white/25">
          {initials(user?.name)}
        </span>
        {/* Name is hidden on narrow screens; the avatar alone is the control there. */}
        <span className="hidden text-left sm:block">
          <span className="block text-sm leading-tight font-medium text-white">{user?.name}</span>
          <span className="block text-xs leading-tight text-emerald-100/70">
            {isManager ? 'Manager' : 'Team member'}
          </span>
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          aria-hidden="true"
          className={`size-4 text-emerald-100/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 7.5 5 5 5-5" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-56 origin-top-right animate-menu-in overflow-hidden rounded-xl bg-navy-800 shadow-2xl shadow-black/50 ring-1 ring-white/10"
        >
          <div className="border-b border-white/5 px-3.5 py-3">
            <p className="truncate text-sm font-medium text-ink-100">{user?.name}</p>
            <p className="truncate text-xs text-ink-500">{user?.email}</p>
          </div>

          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => go('/profile')}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-ink-300 transition hover:bg-white/5 hover:text-ink-100"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                aria-hidden="true"
                className="size-4.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM5 20a7 7 0 0 1 14 0"
                />
              </svg>
              Profile &amp; settings
            </button>

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
                aria-hidden="true"
                className="size-4.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 17v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1m4 5H9m10 0-3-3m3 3-3 3"
                />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
