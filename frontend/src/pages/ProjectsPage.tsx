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
import { Pagination } from '../components/Pagination'
import { RowButton } from '../components/RowButton'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { SelectField } from '../components/SelectField'
import { TextAreaField } from '../components/TextAreaField'
import { TextField } from '../components/TextField'
import type { ProjectDetail } from '../types/api'

/**
 * Paginated in the browser, for the same reason the filters are: `GET /projects/all` returns
 * every project in one unpaginated response. Paging on the server while filtering here would
 * be actively wrong - the search would only ever see the current page.
 */
const PAGE_SIZE = 10

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

  /*
   * Filtered in the browser, not on the server. `GET /projects/all` returns every project in
   * one unpaginated call - there are five seeded and a team adds a handful - so filtering
   * here is instant and costs no request. A `?search=` parameter would be the right answer
   * only once the list outgrows a single response.
   */
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')
  const [pageNumber, setPageNumber] = useState(0)

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

  /** The project the confirmation popup is about, or undefined when it is closed. */
  const pendingDelete = confirmId === null ? undefined : projects?.find((p) => p.id === confirmId)

  /**
   * Matches the search against the name *and* the description, because a manager looking for
   * "the client work" will not remember which of the two carries that word.
   *
   * Both sides are lower-cased rather than using a case-insensitive regex: the term is user
   * input and would otherwise need escaping before it could be a pattern.
   */
  function matches(project: ProjectDetail): boolean {
    if (status === 'ACTIVE' && !project.active) return false
    if (status === 'INACTIVE' && project.active) return false

    const term = search.trim().toLowerCase()
    if (term === '') return true
    return (
      project.name.toLowerCase().includes(term) ||
      (project.description ?? '').toLowerCase().includes(term)
    )
  }

  const visible = (projects ?? []).filter(matches)
  const filtered = search.trim() !== '' || status !== 'ALL'

  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE))
  /*
   * Clamped during render rather than reset from an effect. Narrowing the search or deleting
   * the last row on a page can both leave `pageNumber` past the end, and the honest fix is to
   * derive what to show instead of chasing it with a setState - which is also what this
   * repo's `react(set-state-in-effect)` rule asks for.
   */
  const currentPage = Math.min(pageNumber, totalPages - 1)
  const pageItems = visible.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE)

  function clearFilters() {
    setSearch('')
    setStatus('ALL')
    setPageNumber(0)
  }

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

      {/* Hidden until there is something to filter - two controls over a list of two
          projects is more chrome than help. */}
      {projects !== null && projects.length > 0 && (
        <div className="rounded-xl bg-navy-800 p-4 shadow-lg shadow-black/20 ring-1 ring-white/5">
          <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
            <label>
              <span className="block text-sm font-medium text-ink-300">Search</span>
              <div className="relative mt-1.5">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPageNumber(0)
                  }}
                  placeholder="Name or description..."
                  aria-label="Search projects by name or description"
                  /* pr-9 leaves room for the clear button. The bracket rule removes the
                     browser's own search cross, which cannot be styled and would otherwise
                     sit beside ours looking like a duplicate. */
                  className="block w-full appearance-none rounded-lg bg-navy-900/70 py-2 pl-3 pr-9 text-sm text-ink-100 ring-1 ring-inset ring-white/10 transition placeholder:text-ink-500 hover:ring-white/20 focus:bg-navy-900 focus:ring-2 focus:ring-inset focus:ring-brand-400 focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
                />
                {search !== '' && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setPageNumber(0)
                    }}
                    aria-label="Clear search"
                    title="Clear search"
                    className="absolute inset-y-0 right-0 grid w-9 place-items-center text-ink-500 transition hover:text-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-400"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} aria-hidden="true" className="size-4">
                      <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </div>
            </label>

            <SelectField
              label="Status"
              name="project-status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as typeof status)
                setPageNumber(0)
              }}
            >
              <option value="ALL">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </SelectField>
          </div>

          {filtered && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <p className="text-xs text-ink-500">
                Showing <span className="text-ink-300">{visible.length}</span> of{' '}
                {projects.length} project{projects.length === 1 ? '' : 's'}
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-brand-300 transition hover:text-brand-200"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
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
        ) : visible.length === 0 ? (
          /* Distinct from "no projects yet": there are projects, just none matching. Telling
             the manager to add one would be the wrong suggestion. */
          <EmptyState
            title="No projects match"
            description="Nothing matches the current search and status. Try a different term."
            action={
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-white/5">
            {pageItems.map((project) => (
              /* `group` drives the hover styling below. The row is not itself clickable - the
                 actions are - so the highlight is a scanning aid rather than an affordance,
                 which is why it tints rather than showing a pointer cursor. */
              <li
                key={project.id}
                className="group px-4 py-3.5 transition-colors hover:bg-white/[0.04]"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    {/* Emerald rather than the brand violet: violet is what selection and
                        primary actions use throughout the app, so a violet hover would read
                        as "selected". Emerald ties to the navigation chrome instead and is
                        unambiguous. */}
                    <p className="flex items-center gap-2 text-base font-medium text-ink-100 transition-colors group-hover:text-emerald-300">
                      <span className="truncate">{project.name}</span>
                      {!project.active && (
                        <span className="rounded-full bg-white/5 px-2 py-0.5 text-xs font-normal text-ink-500 ring-1 ring-inset ring-white/10">
                          Inactive
                        </span>
                      )}
                    </p>
                    {/* Italic and dimmer than the name, so the two read as heading and
                        subtitle rather than two equal lines of text. */}
                    {project.description && (
                      <p className="mt-1 text-sm text-ink-500 italic">{project.description}</p>
                    )}
                    {/*
                      A recessed chip rather than a darker shade of text. Genuinely darker
                      text on a navy row loses too much contrast to read, so the *background*
                      carries the "darker" and the label stays legible - which also separates
                      the count from the italic description above it.
                    */}
                    <p className="mt-1.5">
                      <span className="inline-block rounded-md bg-navy-900/70 px-2 py-0.5 text-xs text-ink-300 ring-1 ring-inset ring-white/5">
                        {project.reportCount === 0
                          ? 'No reports yet'
                          : `${project.reportCount} report${project.reportCount === 1 ? '' : 's'}`}
                      </span>
                    </p>
                  </div>

                  {/* Own line on a phone, so three buttons are not squeezed against a
                      wrapping project name. */}
                  <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                    <RowButton tone="edit" onClick={() => openEdit(project)}>
                      Edit
                    </RowButton>
                    <RowButton
                      tone={project.active ? 'retire' : 'restore'}
                      onClick={() => toggleActive(project)}
                      disabled={busyId === project.id}
                    >
                      {project.active ? 'Deactivate' : 'Activate'}
                    </RowButton>

                    {/* Offered only when nothing references it: the backend would refuse
                        otherwise, and a button that always fails is worse than no button. */}
                    {project.reportCount === 0 && (
                      <RowButton tone="danger" onClick={() => setConfirmId(project.id)}>
                        Delete
                      </RowButton>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Hidden on a single page: a control that can only say "1 of 1" is noise. Built from
            the filtered list, so the counts describe what is actually on screen. */}
        {projects !== null && visible.length > PAGE_SIZE && (
          <Pagination
            page={currentPage}
            size={PAGE_SIZE}
            totalElements={visible.length}
            totalPages={totalPages}
            first={currentPage === 0}
            last={currentPage >= totalPages - 1}
            onChange={setPageNumber}
          />
        )}
      </Card>

      {/* The same confirmation the draft delete uses, so a destructive action asks the same
          way everywhere. `pendingDelete` is derived from the list, so the popup cannot
          outlive the row it is about. */}
      <ConfirmDialog
        open={pendingDelete !== undefined}
        title={'Delete \u201c' + (pendingDelete?.name ?? '') + '\u201d?'}
        confirmLabel={busyId === confirmId ? 'Deleting...' : 'Yes, delete'}
        cancelLabel="No"
        loading={busyId === confirmId}
        onConfirm={() => {
          if (pendingDelete) void handleDelete(pendingDelete)
        }}
        onCancel={() => setConfirmId(null)}
      >
        This project has no reports against it, so nothing loses its tag. It cannot be undone.
      </ConfirmDialog>
    </section>
  )
}

/** Alphabetical, matching the order the backend returns, so a rename doesn't jump rows. */
function sorted(projects: ProjectDetail[]): ProjectDetail[] {
  return [...projects].sort((left, right) => left.name.localeCompare(right.name))
}
