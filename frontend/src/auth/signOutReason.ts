/**
 * Why the last sign-out happened, when it was not the user's own choice — an expired token,
 * or a manager changing their role or access.
 *
 * A separate module from `AuthProvider` because that file may only export components: the
 * lint rule `react(only-export-components)` flags a mixed file, since Fast Refresh cannot
 * hot-swap a module that exports both. Same reason `reportFilterState.ts` is split out.
 *
 * `sessionStorage`, not React state: the sign-out is triggered from the API client, outside
 * the component tree, and the screen that shows the message has not mounted yet. Not
 * `localStorage` either — the message is about this browsing session and must not resurface
 * days later in a new tab.
 */
const KEY = 'wrg.signOutReason'

export function rememberSignOutReason(reason: string | undefined): void {
  try {
    // Cleared when there is no reason, so a deliberate sign-out from the menu never inherits
    // the explanation left by an earlier involuntary one.
    if (reason) window.sessionStorage.setItem(KEY, reason)
    else window.sessionStorage.removeItem(KEY)
  } catch {
    // Private browsing or blocked storage. The sign-out itself has already happened, which
    // is the part that matters; only the explanation is lost.
  }
}

/** Read once and cleared, so the notice shows on the next sign-in screen and no later. */
export function takeSignOutReason(): string | null {
  try {
    const reason = window.sessionStorage.getItem(KEY)
    if (reason) window.sessionStorage.removeItem(KEY)
    return reason
  } catch {
    return null
  }
}
