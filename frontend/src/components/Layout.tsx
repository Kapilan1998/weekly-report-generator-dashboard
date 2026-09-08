import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { UserMenu } from './UserMenu'

const COLLAPSE_KEY = 'wrg.nav.collapsed'

interface NavItem {
  to: string
  label: string
  icon: 'reports' | 'team' | 'compare' | 'projects' | 'users' | 'profile'
  managerOnly?: boolean
}

// Detail, create/edit and review pages are reached from a list rather than from the nav -
// they all need an id, so there is no meaningful nav destination for them.
const NAV: NavItem[] = [
  { to: '/reports', label: 'My reports', icon: 'reports' },
  { to: '/team', label: 'Team dashboard', icon: 'team', managerOnly: true },
  { to: '/team/sections', label: 'Compare sections', icon: 'compare', managerOnly: true },
  { to: '/projects', label: 'Projects', icon: 'projects', managerOnly: true },
  { to: '/admin/users', label: 'User management', icon: 'users', managerOnly: true },
  { to: '/profile', label: 'Profile & settings', icon: 'profile' },
]

function Icon({ name }: { name: NavItem['icon'] }) {
  const shared = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7 }
  if (name === 'team') {
    return (
      <svg {...shared} aria-hidden="true" className="size-5 shrink-0">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20h4v-2a3 3 0 0 0-3-3h-1m-3 5H3v-2a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v2Zm-2-11a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 1a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
        />
      </svg>
    )
  }
  if (name === 'compare') {
    return (
      <svg {...shared} aria-hidden="true" className="size-5 shrink-0">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 5h6v14H4V5Zm10 0h6v14h-6V5Z"
        />
      </svg>
    )
  }
  if (name === 'projects') {
    return (
      <svg {...shared} aria-hidden="true" className="size-5 shrink-0">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7a2 2 0 0 1 2-2h3.6a2 2 0 0 1 1.5.7l1 1.3H19a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        />
      </svg>
    )
  }
  if (name === 'users') {
    return (
      <svg {...shared} aria-hidden="true" className="size-5 shrink-0">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0 0c-3 0-5.5 1.8-5.5 4v2h11v-2c0-2.2-2.5-4-5.5-4Zm7-6.5a3 3 0 0 1 0 6m1.5 2.2c2 .6 3.5 2 3.5 3.8V19h-3"
        />
      </svg>
    )
  }
  if (name === 'profile') {
    return (
      <svg {...shared} aria-hidden="true" className="size-5 shrink-0">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.5 8.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0ZM5 20a7 7 0 0 1 14 0"
        />
      </svg>
    )
  }
  return (
    <svg {...shared} aria-hidden="true" className="size-5 shrink-0">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 4h8a2 2 0 0 1 2 2v14l-6-3-6 3V6a2 2 0 0 1 2-2Z"
      />
    </svg>
  )
}

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === 'true'
  } catch {
    return false
  }
}

export function Layout() {
  const { isManager } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const items = NAV.filter((item) => !item.managerOnly || isManager)
  // Longest match wins: /team/sections starts with /team too, and the breadcrumb has to name
  // the page you are on rather than its prefix.
  const currentLabel =
    items
      .filter(
        (item) =>
          location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
      )
      .sort((left, right) => right.to.length - left.to.length)[0]?.label ?? ''

  // Remembered per browser, so the choice survives a reload.
  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, String(collapsed))
    } catch {
      // Private browsing - the sidebar just won't remember its state.
    }
  }, [collapsed])

  // Escape closes the mobile drawer, the expected way out of any overlay.
  useEffect(() => {
    if (!drawerOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [drawerOpen])

  /** `railed` renders the icon-only variant used by the collapsed desktop sidebar. */
  function navLinks(railed: boolean) {
    return items.map((item) => (
      <NavLink
        key={item.to}
        to={item.to}
        end
        onClick={() => setDrawerOpen(false)}
        // Native tooltip so a collapsed icon is still identifiable.
        title={railed ? item.label : undefined}
        className={({ isActive }) =>
          `flex items-center rounded-lg py-2.5 text-sm font-medium transition ${
            railed ? 'justify-center px-2' : 'gap-3 px-3'
          } ${
            isActive
              ? 'bg-emerald-300/20 text-white ring-1 ring-emerald-300/30'
              : 'text-emerald-50/70 hover:bg-white/10 hover:text-white'
          }`
        }
      >
        <Icon name={item.icon} />
        {!railed && <span className="truncate">{item.label}</span>}
      </NavLink>
    ))
  }

  return (
    <div className="min-h-svh">
      {/* Top bar: full width, carrying the green identity from the sign-in panel. */}
      <header className="sticky top-0 z-30 h-14 border-b border-emerald-400/20 bg-gradient-to-r from-emerald-900 via-teal-900 to-teal-950 shadow-lg shadow-black/20">
        <div className="flex h-full items-center gap-3 px-3 sm:px-4">
          {/* Mobile only: the sidebar has no room to live on screen at this width. */}
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="grid size-9 shrink-0 place-items-center rounded-lg text-emerald-50/80 ring-1 ring-white/15 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              aria-hidden="true"
              className="size-5"
            >
              <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => navigate('/reports')}
            className="flex shrink-0 items-center gap-2.5 rounded-lg px-1 py-1 transition hover:opacity-90"
          >
            <span className="grid size-8 place-items-center rounded-lg bg-white/10 text-xs font-bold text-white ring-1 ring-white/20">
              WR
            </span>
            <span className="hidden text-sm font-semibold tracking-tight text-white sm:block">
              Weekly Reports
            </span>
          </button>

          {currentLabel && (
            <>
              <span aria-hidden="true" className="hidden text-emerald-100/40 md:block">
                /
              </span>
              <span className="hidden truncate text-sm text-emerald-50/80 md:block">
                {currentLabel}
              </span>
            </>
          )}

          <div className="ml-auto">
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar: always on screen, collapsing to an icon rail rather than hiding.
            Sticky under the 3.5rem top bar so it stays put while content scrolls. */}
        <aside
          className={`sticky top-14 hidden h-[calc(100svh-3.5rem)] shrink-0 flex-col border-r border-emerald-400/20 bg-gradient-to-b from-emerald-900 via-teal-900 to-teal-950 transition-[width] duration-300 ease-out lg:flex ${
            collapsed ? 'w-16' : 'w-64'
          }`}
        >
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
            {navLinks(collapsed)}
          </nav>

          <div className="border-t border-white/10 p-3">
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`flex w-full items-center rounded-lg py-2.5 text-sm font-medium text-emerald-50/70 transition hover:bg-white/10 hover:text-white ${
                collapsed ? 'justify-center px-2' : 'gap-3 px-3'
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                aria-hidden="true"
                className={`size-5 shrink-0 transition-transform duration-300 ${
                  collapsed ? 'rotate-180' : ''
                }`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m14 7-5 5 5 5" />
              </svg>
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 animate-fade-in bg-navy-950/70 backdrop-blur-sm"
            />
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-drawer-in flex-col border-r border-emerald-400/20 bg-gradient-to-b from-emerald-900 via-teal-900 to-teal-950 shadow-2xl shadow-black/60">
              <div className="flex items-center justify-between px-5 py-4">
                <span className="text-xs font-semibold tracking-wider text-emerald-100/60 uppercase">
                  Menu
                </span>
                <button
                  type="button"
                  aria-label="Close navigation"
                  onClick={() => setDrawerOpen(false)}
                  className="grid size-8 place-items-center rounded-lg text-emerald-50/70 transition hover:bg-white/10 hover:text-white"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="size-4.5"
                  >
                    <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </div>
              <nav className="flex flex-col gap-1 px-3">{navLinks(false)}</nav>
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
