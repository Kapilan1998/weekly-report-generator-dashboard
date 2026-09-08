import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { approveReport, getReport, requestChanges } from '../api/reports'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Card, EmptyState, PageHeader } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { TextAreaField } from '../components/TextAreaField'
import { CorrectionBanner } from '../features/reports/CorrectionBanner'
import { ReportContentView } from '../features/reports/ReportContentView'
import { VersionHistoryPanel } from '../features/reports/VersionHistoryPanel'
import { formatDateTime, formatWeek } from '../lib/format'
import type { ReportDetail } from '../types/api'

const COMMENT_MAX = 2000

type Decision = 'APPROVE' | 'REQUEST_CHANGES'

/**
 * The manager's review page: read a submitted report, then approve it or send it back with
 * a comment.
 *
 * The two decisions are one form with a mode switch rather than two buttons that each open
 * something, because the comment means different things in each: optional praise on an
 * approval, and the required instruction the author will work from on a change request. A
 * single visible textarea whose label and requirement change with the mode makes that
 * difference legible before anything is submitted.
 *
 * `report.reviewable` comes from the backend and is the only thing consulted to decide
 * whether the panel is live — it already encodes all three rules (manager, not your own
 * report, status is Submitted). Re-deriving them here would be a second copy to keep in
 * step, and the backend refuses regardless.
 */
export function ReviewPage() {
  const { reportId: reportIdParam } = useParams<{ reportId: string }>()
  const reportId = Number(reportIdParam)
  const { user } = useAuth()

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadStatus, setLoadStatus] = useState<number | null>(null)

  const [decision, setDecision] = useState<Decision>('APPROVE')
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Decision | null>(null)

  useEffect(() => {
    let active = true
    getReport(reportId)
      .then((result) => {
        if (active) setReport(result)
      })
      .catch((caught: unknown) => {
        if (!active) return
        if (caught instanceof ApiError) setLoadStatus(caught.status)
        else setError('Could not load this report.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reportId])

  async function handleSubmit() {
    const trimmed = comment.trim()

    // Mirrors the backend's own validation so the round trip isn't needed to be told.
    if (decision === 'REQUEST_CHANGES' && trimmed === '') {
      setCommentError('Explain what needs correcting — the author only sees this comment.')
      return
    }
    if (trimmed.length > COMMENT_MAX) {
      setCommentError(`Comment must be at most ${COMMENT_MAX} characters`)
      return
    }

    setCommentError(undefined)
    setSubmitting(true)
    setError(null)
    try {
      const updated =
        decision === 'APPROVE'
          ? await approveReport(reportId, trimmed === '' ? undefined : trimmed)
          : await requestChanges(reportId, trimmed)
      setReport(updated)
      setDone(decision)
      setComment('')
    } catch (caught) {
      if (caught instanceof ApiError) {
        setCommentError(caught.firstFieldError)
        setError(caught.message)
      } else {
        setError('Could not record the decision.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-500">Loading…</p>
  }

  // A manager opening someone else's draft. Its content stays private to the author.
  if (loadStatus === 403) {
    return (
      <Card>
        <EmptyState
          title="This report is still a draft"
          description="There is nothing to review until the author submits it."
          action={
            <Link to="/team" className="text-sm font-medium text-brand-300 hover:text-brand-200">
              Back to team dashboard
            </Link>
          }
        />
      </Card>
    )
  }

  if (loadStatus !== null || !report) {
    return (
      <Card>
        <EmptyState
          title="Report not found"
          description="It may have been deleted."
          action={
            <Link to="/team" className="text-sm font-medium text-brand-300 hover:text-brand-200">
              Back to team dashboard
            </Link>
          }
        />
      </Card>
    )
  }

  const isOwnReport = user?.id === report.owner.id
  const requestingChanges = decision === 'REQUEST_CHANGES'

  return (
    <section className="animate-fade-up space-y-4">
      <PageHeader
        title={`Review — ${report.owner.name}`}
        description={`${formatWeek(report.weekStart, report.weekEnd)} · ${report.project.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            <Link
              to={`/reports/${report.id}`}
              className="rounded-lg bg-navy-700 px-3.5 py-2.5 text-sm font-medium text-ink-100 ring-1 ring-inset ring-white/10 transition hover:bg-navy-600"
            >
              Open full report
            </Link>
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}

      {done && (
        <Alert tone={done === 'APPROVE' ? 'success' : 'warning'}>
          {done === 'APPROVE'
            ? `Approved. ${report.owner.name} can see the decision on their report page.`
            : `Sent back to ${report.owner.name}. Their next edit starts version ${report.content.versionNumber + 1}.`}{' '}
          <Link to="/team" className="font-medium underline">
            Back to the dashboard
          </Link>
        </Alert>
      )}

      {/* The decision panel, or the reason there isn't one. */}
      {report.reviewable ? (
        <Card>
          <div className="border-b border-white/5 bg-navy-700/30 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink-100">Your decision</h2>
            <p className="mt-0.5 text-xs text-ink-500">
              Reviewing version {report.content.versionNumber}, submitted{' '}
              {formatDateTime(report.lastSubmittedAt)}
            </p>
          </div>

          <div className="space-y-4 p-4">
            <fieldset>
              <legend className="text-xs font-semibold tracking-wide text-ink-500 uppercase">
                Outcome
              </legend>
              <div className="mt-2 flex flex-wrap gap-2">
                <DecisionOption
                  label="Approve"
                  description="Accept the report as filed"
                  checked={!requestingChanges}
                  tone="approve"
                  onSelect={() => {
                    setDecision('APPROVE')
                    setCommentError(undefined)
                  }}
                />
                <DecisionOption
                  label="Request changes"
                  description="Send it back for correction"
                  checked={requestingChanges}
                  tone="changes"
                  onSelect={() => setDecision('REQUEST_CHANGES')}
                />
              </div>
            </fieldset>

            <TextAreaField
              label={requestingChanges ? 'What needs correcting' : 'Note (optional)'}
              name="review-comment"
              rows={4}
              value={comment}
              maxLength={COMMENT_MAX}
              showCount
              error={commentError}
              hint={
                requestingChanges
                  ? 'Required. This is the only thing the author sees, so be specific.'
                  : 'Optional. Shown to the author alongside the approval.'
              }
              placeholder={
                requestingChanges
                  ? 'e.g. The hours breakdown adds up to 32h but the tasks total 26h — please reconcile them.'
                  : 'e.g. Clear write-up, thanks.'
              }
              onChange={(event) => {
                setComment(event.target.value)
                if (commentError) setCommentError(undefined)
              }}
            />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={requestingChanges ? 'danger' : 'primary'}
                loading={submitting}
                onClick={handleSubmit}
              >
                {requestingChanges ? 'Request changes' : 'Approve report'}
              </Button>
              <Link
                to="/team"
                className="rounded-lg px-3.5 py-2.5 text-sm font-medium text-ink-300 transition hover:bg-white/5 hover:text-ink-100"
              >
                Cancel
              </Link>
            </div>
          </div>
        </Card>
      ) : (
        !done && (
          <Alert tone="info" title="No decision to make here">
            {isOwnReport
              ? 'This is your own report — a manager cannot review their own submission.'
              : report.status === 'APPROVED'
                ? 'This report is already approved.'
                : report.status === 'NEEDS_CORRECTION'
                  ? 'Changes have already been requested. It comes back for review once the author resubmits.'
                  : 'Only a submitted report can be reviewed.'}
          </Alert>
        )
      )}

      {/* The previous decision, if any, so a resubmission is judged against what was asked. */}
      {report.latestReviewComment && (
        <CorrectionBanner
          comment={report.latestReviewComment}
          tone={report.latestReviewComment.action === 'APPROVE' ? 'approved' : 'correction'}
        />
      )}

      <Card>
        <ReportContentView content={report.content} />
      </Card>

      {report.submittedVersionCount > 0 && (
        <Card>
          <VersionHistoryPanel
            reportId={report.id}
            currentVersionNumber={report.content.versionNumber}
          />
        </Card>
      )}
    </section>
  )
}

/** A radio dressed as a card, so the choice reads as a decision rather than a setting. */
function DecisionOption({
  label,
  description,
  checked,
  tone,
  onSelect,
}: {
  label: string
  description: string
  checked: boolean
  tone: 'approve' | 'changes'
  onSelect: () => void
}) {
  const activeRing =
    tone === 'approve'
      ? 'bg-emerald-500/10 ring-emerald-400/40'
      : 'bg-amber-500/10 ring-amber-400/40'

  return (
    <label
      className={`flex-1 cursor-pointer rounded-lg px-3.5 py-3 ring-1 ring-inset transition ${
        checked ? activeRing : 'ring-white/10 hover:bg-white/5'
      }`}
    >
      <span className="flex items-center gap-2.5">
        <input
          type="radio"
          name="review-decision"
          checked={checked}
          onChange={onSelect}
          className="size-4 accent-brand-500"
        />
        <span>
          <span className="block text-sm font-medium text-ink-100">{label}</span>
          <span className="block text-xs text-ink-500">{description}</span>
        </span>
      </span>
    </label>
  )
}
