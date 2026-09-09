import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/client'
import { listProjects } from '../api/projects'
import {
  createReport,
  getReport,
  listMyReports,
  submitReport,
  updateReport,
} from '../api/reports'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Card, PageHeader } from '../components/Card'
import { SelectField } from '../components/SelectField'
import { TextAreaField } from '../components/TextAreaField'
import { WeekField } from '../components/WeekField'
import { CorrectionBanner } from '../features/reports/CorrectionBanner'
import { FlaggableList } from '../features/reports/FlaggableList'
import { HoursGrid } from '../features/reports/HoursGrid'
import { TaskTable } from '../features/reports/TaskTable'
import {
  blankForm,
  formFromContent,
  toContentInput,
  validateForSubmit,
  validateStructure,
} from '../features/reports/reportFormState'
import type { FieldErrors, ReportFormState } from '../features/reports/reportFormState'
import { currentMonday, mondayOf, weekEndOf } from '../lib/week'
import { formatWeek } from '../lib/format'
import type { ProjectSummary, ReportDetail, ReportSummary } from '../types/api'

/** Serves both /reports/new and /reports/:id/edit — the field set is identical either way. */
export function ReportFormPage() {
  const { id } = useParams<{ id: string }>()
  const isEdit = id !== undefined
  const reportId = Number(id)
  const navigate = useNavigate()

  const [form, setForm] = useState<ReportFormState>(() => blankForm(currentMonday()))
  const [existing, setExisting] = useState<ReportDetail | null>(null)
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [errors, setErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  // The report already filed for the week just attempted, looked up after a 409 so the
  // member can open it instead of hunting for it in their history.
  const [conflict, setConflict] = useState<ReportSummary | null>(null)

  useEffect(() => {
    let active = true

    const projectsPromise = listProjects().then((result) => {
      if (active) setProjects(result)
    })

    const reportPromise = isEdit
      ? getReport(reportId).then((detail) => {
          if (!active) return
          setExisting(detail)
          setForm(formFromContent(detail.content, detail.project.id, detail.weekStart))
        })
      : Promise.resolve()

    Promise.all([projectsPromise, reportPromise])
      .catch((caught: unknown) => {
        if (active) {
          setBanner(caught instanceof ApiError ? caught.message : 'Could not load this report.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [isEdit, reportId])

  function patch(next: Partial<ReportFormState>) {
    setForm((current) => ({ ...current, ...next }))
  }

  /**
   * A duplicate week comes back as a 409 carrying no `fieldErrors`, so the default path
   * would show it as a banner detached from the field it is about. Put it on the week input
   * and look the existing report up, so "you already have one" comes with a way to open it.
   */
  async function handleSaveError(caught: unknown, fallback: string) {
    if (!(caught instanceof ApiError)) {
      setBanner(fallback)
      return
    }

    const isDuplicateWeek =
      !isEdit && caught.status === 409 && Object.keys(caught.fieldErrors).length === 0
    if (!isDuplicateWeek) {
      applyServerErrors(caught)
      return
    }

    setErrors({ weekStart: caught.message })
    setBanner(null)
    try {
      const page = await listMyReports({ weekStart: mondayOf(form.weekStart), size: 1 })
      setConflict(page.content[0] ?? null)
    } catch {
      // The inline message is still correct on its own; only the shortcut is lost.
    }
  }

  /** Turns a backend fieldErrors map into our dotted keys where it lines up. */
  function applyServerErrors(caught: ApiError) {
    const mapped: FieldErrors = {}
    Object.entries(caught.fieldErrors).forEach(([key, message]) => {
      mapped[key.replace(/\[(\d+)\]/g, '.$1')] = message
    })
    setErrors(mapped)
    setBanner(Object.keys(mapped).length > 0 ? null : caught.message)
  }

  async function persist(): Promise<ReportDetail | null> {
    // Structural rules apply even to a draft: the backend bean-validates a draft's payload
    // just as strictly as a submission.
    const structural = validateStructure(form, !isEdit)
    setErrors(structural)
    if (Object.keys(structural).length > 0) {
      setBanner('Fix the highlighted fields and try again.')
      return null
    }

    setBanner(null)
    const content = toContentInput(form)

    if (isEdit) {
      return updateReport(reportId, content)
    }
    return createReport({ ...content, weekStart: mondayOf(form.weekStart) })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const saved = await persist()
      if (saved) navigate(`/reports/${saved.id}`)
    } catch (caught) {
      await handleSaveError(caught, 'Could not save this report.')
    } finally {
      setSaving(false)
    }
  }

  /** Save then submit, so the member never has to save and then find the submit button. */
  async function handleSaveAndSubmit() {
    const completeness = validateForSubmit(form)
    if (Object.keys(completeness).length > 0) {
      setErrors((current) => ({ ...current, ...completeness }))
      setBanner('Add at least one task and fill in next week’s plan before submitting.')
      return
    }

    setSaving(true)
    try {
      const saved = await persist()
      if (!saved) return
      await submitReport(saved.id)
      navigate(`/reports/${saved.id}`)
    } catch (caught) {
      await handleSaveError(caught, 'Could not submit this report.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-ink-500">Loading…</p>

  // An approved or submitted report is not editable; the backend would refuse the save.
  if (isEdit && existing && !existing.editable) {
    return (
      <section className="animate-fade-up">
        <Alert tone="warning">
          This report can&apos;t be edited while it is {existing.status.toLowerCase().replace('_', ' ')}.{' '}
          <Link to={`/reports/${reportId}`} className="font-medium underline">
            View it instead
          </Link>
          .
        </Alert>
      </section>
    )
  }

  // The project tag freezes once anything has been submitted, so an already-reviewed
  // version's context can't be rewritten underneath it.
  const projectLocked = existing?.lastSubmittedAt != null
  // GET /api/projects returns active projects only, so an existing tag that has since been
  // archived has to be added back or the select would render blank and silently retag.
  const projectOptions =
    existing && !projects.some((project) => project.id === existing.project.id)
      ? [...projects, { ...existing.project, name: `${existing.project.name} (inactive)` }]
      : projects

  const weekStartMonday = mondayOf(form.weekStart)
  const showCorrection =
    existing?.status === 'NEEDS_CORRECTION' &&
    existing.latestReviewComment?.action === 'REQUEST_CHANGES'

  return (
    <section className="animate-fade-up space-y-4">
      <PageHeader
        title={isEdit ? 'Edit weekly report' : 'New weekly report'}
        description="Every report uses the same fields, so the team's reports stay comparable."
      />

      {banner && <Alert>{banner}</Alert>}

      {showCorrection && existing?.latestReviewComment && (
        <CorrectionBanner comment={existing.latestReviewComment} tone="correction" variant="form" />
      )}

      <Card>
        <div className="space-y-6 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {isEdit ? (
              <div>
                <span className="block text-sm font-medium text-ink-300">Week</span>
                <p className="mt-1.5 rounded-lg bg-navy-900/40 px-3.5 py-2.5 text-sm text-ink-100 ring-1 ring-inset ring-white/5">
                  {existing ? formatWeek(existing.weekStart, existing.weekEnd) : '—'}
                </p>
                {/* A report's week is its identity, so it cannot move - the update payload
                    carries no week and an editable field here would be silently ignored. */}
                <p className="mt-1.5 text-xs text-ink-500">A report&apos;s week can&apos;t be changed.</p>
              </div>
            ) : (
              <div>
                <WeekField
                  label="Week"
                  id="weekStart"
                  value={form.weekStart}
                  error={errors.weekStart}
                  onChange={(monday) => {
                    // Picking a different week retracts both the shortcut and the message:
                    // each of them named the week that was just replaced.
                    setConflict(null)
                    setErrors(({ weekStart: _cleared, ...rest }) => rest)
                    patch({ weekStart: monday })
                  }}
                />
                {conflict ? (
                  <Link
                    to={`/reports/${conflict.id}`}
                    className="mt-1.5 inline-block text-xs font-medium text-brand-300 transition hover:text-brand-200"
                  >
                    Open your existing report for this week →
                  </Link>
                ) : (
                  weekStartMonday && (
                    <p className="mt-1.5 text-xs text-ink-500">
                      Covers {formatWeek(weekStartMonday, weekEndOf(weekStartMonday))}.
                    </p>
                  )
                )}
              </div>
            )}

            <div>
              <SelectField
                label="Project / category"
                name="projectId"
                value={form.projectId}
                disabled={projectLocked}
                error={errors.projectId}
                onChange={(event) => patch({ projectId: event.target.value })}
              >
                <option value="">Choose a project…</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </SelectField>
              {projectLocked && (
                <p className="mt-1.5 text-xs text-ink-500">
                  Locked — the project can&apos;t change after the report has been submitted.
                </p>
              )}
            </div>
          </div>

          <TaskTable
            rows={form.tasks}
            errors={errors}
            disabled={saving}
            onChange={(tasks) => patch({ tasks })}
          />

          <TextAreaField
            label="Tasks planned for next week"
            name="tasksPlannedNextWeek"
            rows={5}
            maxLength={4000}
            showCount
            value={form.tasksPlannedNextWeek}
            error={errors.tasksPlannedNextWeek}
            disabled={saving}
            onChange={(event) => patch({ tasksPlannedNextWeek: event.target.value })}
          />

          <FlaggableList
            legend="Blockers / challenges"
            description="Anything that slowed you down. Flag one as the week's key issue."
            flagLabel="Key issue for the week"
            addLabel="+ Add blocker"
            placeholder="What blocked you?"
            radioName="key-issue"
            rowPrefix="blocker"
            rows={form.blockers}
            error={errors.blockers}
            disabled={saving}
            onChange={(blockers) => patch({ blockers })}
          />

          <FlaggableList
            legend="Achievements / highlights"
            description="What went well. Flag one as the week's key achievement."
            flagLabel="Key achievement for the week"
            addLabel="+ Add achievement"
            placeholder="What went well?"
            radioName="key-achievement"
            rowPrefix="achievement"
            rows={form.achievements}
            error={errors.achievements}
            disabled={saving}
            onChange={(achievements) => patch({ achievements })}
          />

          <HoursGrid
            hours={form.hours}
            errors={errors}
            disabled={saving}
            onChange={(hours) => patch({ hours })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <TextAreaField
              label="Notes (optional)"
              name="notes"
              rows={4}
              maxLength={4000}
              showCount
              value={form.notes}
              disabled={saving}
              onChange={(event) => patch({ notes: event.target.value })}
            />
            <TextAreaField
              label="Links (optional)"
              name="links"
              rows={4}
              maxLength={1000}
              hint="One URL per line"
              value={form.links}
              disabled={saving}
              onChange={(event) => patch({ links: event.target.value })}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/5 bg-navy-700/30 px-4 py-3.5 sm:px-5">
          <Button onClick={handleSave} loading={saving} variant="secondary">
            Save draft
          </Button>
          <Button onClick={handleSaveAndSubmit} loading={saving}>
            Save &amp; submit for review
          </Button>
          <Link
            to={isEdit ? `/reports/${reportId}` : '/reports'}
            className="rounded-lg px-3 py-2.5 text-sm font-medium text-ink-300 transition hover:text-ink-100"
          >
            Cancel
          </Link>
        </div>
      </Card>
    </section>
  )
}
