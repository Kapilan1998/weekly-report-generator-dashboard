import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { getReport, submitReport } from '../api/reports'
import { useAuth } from '../auth/useAuth'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Card, EmptyState, PageHeader } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { CorrectionBanner } from '../features/reports/CorrectionBanner'
import { ReportContentView } from '../features/reports/ReportContentView'
import { VersionHistoryPanel } from '../features/reports/VersionHistoryPanel'
import { isSubmittable } from '../features/reports/reportFormState'
import { formatWeek } from '../lib/format'
import type { ReportDetail } from '../types/api'

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>()
  const reportId = Number(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [report, setReport] = useState<ReportDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(() => {
    return getReport(reportId)
      .then((result) => {
        setReport(result)
        setError(null)
        setStatus(null)
      })
      .catch((caught: unknown) => {
        if (caught instanceof ApiError) {
          setStatus(caught.status)
          setError(caught.message)
        } else {
          setError('Could not load this report.')
        }
      })
  }, [reportId])

  useEffect(() => {
    let active = true
    load().finally(() => {
      if (active) setLoading(false)
    })
    return () => {
      active = false
    }
  }, [load])

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const updated = await submitReport(reportId)
      setReport(updated)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not submit this report.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-ink-500">Loading…</p>
  }

  // 403 here can only mean one thing: a manager opening someone else's draft. The endpoint
  // has no role gate, so there is no need to read the message.
  if (status === 403) {
    return (
      <section className="animate-fade-up">
        <Card>
          <EmptyState
            title="This report is still a draft"
            description="Its content stays private to the author until they submit it for review."
            action={
              <Link
                to="/team"
                className="text-sm font-medium text-brand-300 hover:text-brand-200"
              >
                Back to team dashboard
              </Link>
            }
          />
        </Card>
      </section>
    )
  }

  // A peer's report and a genuinely missing id both return 404, deliberately, so report ids
  // can't be enumerated. The copy has to be truthful for both causes at once.
  if (status === 404 || !report) {
    return (
      <section className="animate-fade-up">
        <Card>
          <EmptyState
            title="Report not found"
            description="It may have been deleted, or it belongs to another team member."
            action={
              <Link
                to="/reports"
                className="text-sm font-medium text-brand-300 hover:text-brand-200"
              >
                Back to my reports
              </Link>
            }
          />
        </Card>
      </section>
    )
  }

  const isOwner = user?.id === report.owner.id
  const workingCopyOpen = report.content.submittedAt === null
  // Submit is possible only when a working copy exists. Right after a manager requests
  // changes the current version is still the frozen one they rejected, and the backend
  // refuses with "no changes have been made since the last submission".
  const canSubmit = report.editable && workingCopyOpen
  const submitBlocked = canSubmit && !isSubmittable(report.content)

  const showCorrection =
    report.status === 'NEEDS_CORRECTION' &&
    report.latestReviewComment?.action === 'REQUEST_CHANGES' &&
    report.editable
  const showApproved = report.status === 'APPROVED' && report.latestReviewComment?.action === 'APPROVE'

  return (
    <section className="animate-fade-up space-y-4">
      <PageHeader
        title={formatWeek(report.weekStart, report.weekEnd)}
        description={`${report.project.name}${isOwner ? '' : ` · ${report.owner.name}`}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={report.status} />
            {report.editable && (
              <Button variant="secondary" onClick={() => navigate(`/reports/${reportId}/edit`)}>
                {workingCopyOpen ? 'Edit report' : 'Edit & resubmit'}
              </Button>
            )}
            {canSubmit && (
              <Button onClick={handleSubmit} loading={submitting} disabled={submitBlocked}>
                Submit for review
              </Button>
            )}
          </div>
        }
      />

      {error && <Alert>{error}</Alert>}

      {submitBlocked && (
        <Alert tone="warning">
          Add at least one task and fill in “tasks planned for next week” before submitting.
        </Alert>
      )}

      {showCorrection && report.latestReviewComment && (
        <CorrectionBanner
          comment={report.latestReviewComment}
          tone="correction"
          action={
            <Button onClick={() => navigate(`/reports/${reportId}/edit`)}>
              {workingCopyOpen ? 'Continue editing' : 'Edit & resubmit'}
            </Button>
          }
        />
      )}

      {showApproved && report.latestReviewComment && (
        <CorrectionBanner comment={report.latestReviewComment} tone="approved" />
      )}

      {report.status === 'SUBMITTED' && isOwner && (
        <p className="text-sm text-ink-500">
          Locked while your manager reviews it. You&apos;ll be able to edit again if they
          request changes.
        </p>
      )}

      <Card>
        <ReportContentView content={report.content} />
      </Card>

      {report.submittedVersionCount > 0 && (
        <Card>
          <VersionHistoryPanel
            reportId={reportId}
            currentVersionNumber={report.content.versionNumber}
          />
        </Card>
      )}
    </section>
  )
}
