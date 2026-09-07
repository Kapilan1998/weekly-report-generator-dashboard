import { useState } from 'react'
import { ApiError } from '../../api/client'
import { getVersion, listVersions } from '../../api/reports'
import { Alert } from '../../components/Alert'
import { formatDateTime } from '../../lib/format'
import { ReportContentView } from './ReportContentView'
import type { ReportVersionDetail, ReportVersionSummary, ReviewComment } from '../../types/api'

/**
 * Past versions of a report, fetched on demand.
 *
 * This is what satisfies "the previous version of that report's content must remain
 * visible" — each submitted version can be opened and read exactly as it was, with the
 * review that was made against it shown alongside, which answers "which version a given
 * comment was made against".
 *
 * The list contains submitted versions only; an open working copy is not a version yet, so
 * the caller labels the on-screen content separately.
 */
function ReviewLine({ review }: { review: ReviewComment }) {
  const approved = review.action === 'APPROVE'
  return (
    <div
      className={`rounded-lg px-3 py-2 text-xs ring-1 ring-inset ${
        approved
          ? 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/25'
          : 'bg-amber-400/10 text-amber-200 ring-amber-400/25'
      }`}
    >
      <p className="font-medium">
        {approved ? 'Approved' : 'Changes requested'} by {review.reviewer.name} ·{' '}
        {formatDateTime(review.createdAt)}
      </p>
      {review.comment && (
        <p className="mt-1 break-words whitespace-pre-wrap text-ink-100">{review.comment}</p>
      )}
    </div>
  )
}

export function VersionHistoryPanel({
  reportId,
  currentVersionNumber,
}: {
  reportId: number
  currentVersionNumber: number
}) {
  const [versions, setVersions] = useState<ReportVersionSummary[] | null>(null)
  const [openVersion, setOpenVersion] = useState<ReportVersionDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Loaded on demand rather than with the page: the brief only asks for the list to be
  // "viewable on demand", and most visits never open it.
  function toggleList() {
    if (versions) {
      setVersions(null)
      setOpenVersion(null)
      return
    }
    setLoading(true)
    setError(null)
    listVersions(reportId)
      .then(setVersions)
      .catch((caught: unknown) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not load version history.'),
      )
      .finally(() => setLoading(false))
  }

  function openOrClose(versionNumber: number) {
    if (openVersion?.content.versionNumber === versionNumber) {
      setOpenVersion(null)
      return
    }
    setLoading(true)
    setError(null)
    getVersion(reportId, versionNumber)
      .then(setOpenVersion)
      .catch((caught: unknown) =>
        setError(caught instanceof ApiError ? caught.message : 'Could not load that version.'),
      )
      .finally(() => setLoading(false))
  }

  return (
    <div className="px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-ink-100">Version history</h2>
          <p className="text-xs text-ink-500">
            Every submitted version is kept. You are currently viewing version{' '}
            {currentVersionNumber}.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleList}
          className="rounded-lg px-3 py-2 text-sm font-medium text-brand-300 transition hover:bg-brand-500/10 hover:text-brand-200"
        >
          {versions ? 'Hide history' : 'View version history'}
        </button>
      </div>

      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}

      {loading && !versions && <p className="mt-3 text-sm text-ink-500">Loading…</p>}

      {versions && (
        <ul className="mt-3 space-y-2">
          {versions.length === 0 && (
            <li className="text-sm text-ink-500">
              Nothing submitted yet, so there are no past versions.
            </li>
          )}

          {versions.map((version) => {
            const isOpen = openVersion?.content.versionNumber === version.versionNumber
            return (
              <li
                key={version.versionNumber}
                className="rounded-lg bg-navy-900/40 ring-1 ring-inset ring-white/5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-100">
                      Version {version.versionNumber}
                      {version.versionNumber === currentVersionNumber && (
                        <span className="ml-2 rounded-full bg-brand-500/15 px-2 py-0.5 text-xs font-medium text-brand-200 ring-1 ring-inset ring-brand-400/25">
                          Currently viewing
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-ink-500">
                      Submitted {formatDateTime(version.submittedAt)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openOrClose(version.versionNumber)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-300 ring-1 ring-inset ring-brand-400/25 transition hover:bg-brand-500/10"
                  >
                    {isOpen ? 'Hide' : 'View this version'}
                  </button>
                </div>

                {version.reviews.length > 0 && (
                  <div className="space-y-1.5 px-3.5 pb-3">
                    {version.reviews.map((review) => (
                      <ReviewLine key={review.id} review={review} />
                    ))}
                  </div>
                )}

                {isOpen && openVersion && (
                  <div className="border-t border-white/5 bg-navy-800/60">
                    <ReportContentView content={openVersion.content} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
