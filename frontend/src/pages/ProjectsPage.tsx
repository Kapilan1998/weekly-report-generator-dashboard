import { useEffect, useState } from 'react'
import { ApiError, errorMessage } from '../api/client'
import {
  createProject,
  deleteProject,
  listAllProjects,
  updateProject,
} from '../api/projects'
import { Alert } from '../components/Alert'
import { Button } from '../components/Button'
import { Card, EmptyState, PageHeader, TableSkeleton } from '../components/Card'
import { TextAreaField } from '../components/TextAreaField'
import { TextField } from '../components/TextField'
import type { ProjectDetail } from '../types/api'

const NAME_MAX = 120
const DESCRIPTION_MAX = 500

interface FormState {
  name: string
  description: string
  active: boolean
}

const BLANK: FormState = { name: '', description: '', active: true }

/**
 * Project / category management.
 *
 * The editor is a panel on the page rather than a modal: a dialog would need focus trapping,
 * scroll locking and its own escape handling to be usable, and none of that buys anything
 * here — there is only ever one project being edited, and the list stays visible beneath it
 * so a rename can be checked against the others.
 *
 * Deleting and deactivating are deliberately separate affordances. A project any report
 * references cannot be deleted — the backend answers 409 with the count, because removing it
 * would strip the tag off reports whose reviewed content has to stay as it was — so the row
 * offers Delete only when the count is zero, and Deactivate is what retires the rest.
 */
export function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectDetail[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // `null` = the editor is closed, `0` = creating, any id = editing that project.
  const [editorId, setEditorId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  useEffect(() => {
    let active = true
    listAllProjects()
      .then((result) => {
        if (active) setProjects(result)
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(errorMessage(caught, 'Could not load projects.'))
          setProjects([])
        }
      })
    return () => {
      active = false
    }
  }, [])

  function openCreate() {
    setEditorId(0)
    setForm(BLANK)
    setFieldErrors({})
    setNotice(null)
  }

  function openEdit(project: ProjectDetail) {
    setEditorId(project.id)
    setForm({
      name: project.name,
      description: project.description ?? '',
      active: project.active,
    })
    setFieldErrors({})
    setNotice(null)
  }

  function closeEditor() {
    setEditorId(null)
    setFieldErrors({})
  }

  async function handleSave() {
    const name = form.name.trim()
    if (name === '') {
      setFieldErrors({ name: 'Project name is required' })
      return
    }

    setSaving(true)
    setError(null)
    try {
      const description = form.description.trim()
      if (editorId === 0) {
        const created = await createProject({
          name,
          // Empty means "no description" rather than an empty string, matching the backend,
          // which trims a blank one to null.
          description: description === '' ? null : description,
        })
        setProjects((current) => sorted([...(current ?? []), created]))
        setNotice(`Created “${created.name}”.`)
      } else if (editorId !== null) {
        const updated = await updateProject(editorId, {
          name,
          description: description === '' ? null : description,
          active: form.active,
        })
        setProjects((current) =>
          sorted((current ?? []).map((entry) => (entry.id === updated.id ? updated : entry))),
        )
        setNotice(`Saved “${updated.name}”.`)
      }
      closeEditor()
    } catch (caught) {
      if (caught instanceof ApiError) {
        setFieldErrors(caught.fieldErrors)
        // A duplicate name comes back as a 409 with no field errors, so the message has to
        // be shown somewhere — on the name field, which is what it is about.
        if (Object.keys(caught.fieldErrors).length === 0) {
          setFieldErrors({ name: caught.message })
        }
      } else {
        setError('Could not save the project.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(project: ProjectDetail) {
    setBusyId(project.id)
    setError(null)
    setNotice(null)
    try {
      const updated = await updateProject(project.id, {
        name: project.name,
        description: project.description,
        active: !project.active,
      })
      setProjects((current) =>
        sorted((current ?? []).map((entry) => (entry.id === updated.id ? updated : entry))),
      )
      setNotice(
        updated.active
          ? `“${updated.name}” is active again and can be tagged on new reports.`
          : `“${updated.name}” is retired — existing reports keep it, new ones can't use it.`,
      )
    } catch (caught) {
      setError(errorMessage(caught, 'Could not update the project.'))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(project: ProjectDetail) {
    setBusyId(project.id)
    setError(null)
    setNotice(null)
    try {
      await deleteProject(project.id)
      setProjects((current) => (current ?? []).filter((entry) => entry.id !== project.id))
      setNotice(`Deleted “${project.name}”.`)
      if (editorId === project.id) closeEditor()
    } catch (caught) {
      setError(errorMessage(caught, 'Could not delete the project.'))
    } finally {
      setBusyId(null)
      setConfirmId(null)
    }
  }

  const editing = editorId !== null && editorId !== 0
  const editingProject = editing ? projects?.find((entry) => entry.id === editorId) : undefined

  return (
    <section className="animate-fade-up space-y-4">
      <PageHeader
        title="Projects"
        description="The categories a weekly report can be filed against."
        actions={
          editorId === null && (
            <Button onClick={openCreate}>+ New project</Button>
          )
        }
      />

      {error && <Alert>{error}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      {editorId !== null && (
        <Card>
          <h2 className="border-b border-white/5 bg-navy-700/30 px-4 py-3 text-sm font-semibold text-ink-100">
            {editing ? `Edit “${editingProject?.name ?? ''}”` : 'New project'}
          </h2>

          <div className="space-y-4 p-4">
            <TextField
              label="Name"
              name="project-name"
              value={form.name}
              maxLength={NAME_MAX}
              error={fieldErrors.name}
              hint="Must be unique — names are compared without regard to case."
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />

            <TextAreaField
              label="Description"
              name="project-description"
              rows={3}
              value={form.description}
              maxLength={DESCRIPTION_MAX}
              showCount
              error={fieldErrors.description}
              hint="Optional."
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />

            {editing && (
              <label className="flex items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  className="mt-0.5 size-4 accent-brand-500"
                />
                <span>
                  <span className="block text-sm text-ink-100">Active</span>
                  <span className="block text-xs text-ink-500">
                    Inactive projects stay on the reports that already reference them but
                    can&apos;t be picked for a new one.
                  </span>
                </span>
              </label>
            )}

            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} loading={saving}>
                {editing ? 'Save changes' : 'Create project'}
              </Button>
              <Button variant="ghost" onClick={closeEditor}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {projects === null ? (
          <TableSkeleton rows={4} columns={4} />
        ) : projects.length === 0 ? (
          !error && (
            <EmptyState
              title="No projects yet"
              description="A report has to be filed against a project, so add at least one."
              action={<Button onClick={openCreate}>+ New project</Button>}
            />
          )
        ) : (
          <ul className="divide-y divide-white/5">
            {projects.map((project) => (
              <li key={project.id} className="px-4 py-3.5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink-100">
                      <span className="truncate">{project.name}</span>
                      {!project.active && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-normal text-ink-500 ring-1 ring-inset ring-white/10">
                          Inactive
                        </span>
                      )}
                    </p>
                    {project.description && (
                      <p className="mt-1 text-sm text-ink-300">{project.description}</p>
                    )}
                    <p className="mt-1 text-xs text-ink-500">
                      {project.reportCount === 0
                        ? 'No reports yet'
                        : `${project.reportCount} report${project.reportCount === 1 ? '' : 's'}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                    <RowButton onClick={() => openEdit(project)}>Edit</RowButton>
                    <RowButton
                      onClick={() => toggleActive(project)}
                      disabled={busyId === project.id}
                    >
                      {project.active ? 'Deactivate' : 'Activate'}
                    </RowButton>

                    {/* Offered only when nothing references it: the backend would refuse
                        otherwise, and a button that always fails is worse than no button. */}
                    {project.reportCount === 0 &&
                      (confirmId === project.id ? (
                        <>
                          <RowButton
                            tone="danger"
                            onClick={() => handleDelete(project)}
                            disabled={busyId === project.id}
                          >
                            Confirm delete
                          </RowButton>
                          <RowButton onClick={() => setConfirmId(null)}>Cancel</RowButton>
                        </>
                      ) : (
                        <RowButton tone="danger" onClick={() => setConfirmId(project.id)}>
                          Delete
                        </RowButton>
                      ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  )
}

/** Alphabetical, matching the order the backend returns, so a rename doesn't jump rows. */
function sorted(projects: ProjectDetail[]): ProjectDetail[] {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name))
}

function RowButton({
  children,
  onClick,
  disabled,
  tone = 'neutral',
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  tone?: 'neutral' | 'danger'
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-300 ring-red-500/25 hover:bg-red-500/10 hover:text-red-200'
      : 'text-ink-300 ring-white/10 hover:bg-white/5 hover:text-ink-100'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset transition disabled:cursor-not-allowed disabled:opacity-50 ${toneClass}`}
    >
      {children}
    </button>
  )
}
