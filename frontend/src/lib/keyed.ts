/**
 * Pairing fetched data with the parameters it was fetched for.
 *
 * A page whose data depends on the URL has to answer "is what I'm holding still the answer
 * to what's on screen?" The obvious way is to clear the state at the top of the fetch effect,
 * but that starts a second render pass on every parameter change — and for one frame before
 * it, the old week's numbers are still on screen under the new week's heading.
 *
 * Keeping the key alongside the data answers it during render instead: if the key doesn't
 * match, what we have is stale and the skeleton shows. The key has to encode every parameter
 * the fetch depended on, which is the same list as the effect's dependencies.
 */
export interface Keyed<T> {
  key: string
  /** `null` records a fetch that failed, so a retry isn't triggered forever. */
  data: T | null
}

/** The data if it belongs to `key` — otherwise null, meaning loading, stale or failed. */
export function fresh<T>(state: Keyed<T> | null, key: string): T | null {
  return state !== null && state.key === key ? state.data : null
}

/** Whether a fetch for `key` has finished, successfully or not. */
export function settled<T>(state: Keyed<T> | null, key: string): boolean {
  return state !== null && state.key === key
}
