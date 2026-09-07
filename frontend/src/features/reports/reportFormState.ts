import type {
  AchievementInput,
  BlockerInput,
  HoursEntryInput,
  ReportContent,
  ReportContentInput,
  TaskEntryInput,
  TaskPriority,
  TaskType,
  TaskWorkStatus,
} from '../../types/api'

/**
 * Form state for the weekly report.
 *
 * Every numeric field is held as a **string**, not a number. An empty `<input type="number">`
 * reads as `''`, and `Number('')` is `0` — so a number-typed state would silently post a
 * perfectly valid-looking `0` for a field the user never filled in. Strings keep "empty" and
 * "zero" distinguishable, and the conversion happens once, at serialise time.
 *
 * Rows carry a client-generated `key`. They cannot be keyed by the server's child id: the
 * backend fully replaces child rows on every save, so those ids change each time and React
 * would remount every row, dropping focus mid-typing.
 */

export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH']
export const TASK_WORK_STATUSES: TaskWorkStatus[] = ['NOT_STARTED', 'IN_PROGRESS', 'DONE', 'BLOCKED']
/** Fixed order, matching the backend enum — the hours grid renders one row per value. */
export const TASK_TYPES: TaskType[] = ['DEVELOPMENT', 'TESTING', 'MEETINGS', 'DOCUMENTATION', 'OTHER']

export interface TaskRowState {
  key: string
  taskName: string
  priority: TaskPriority
  plannedPercent: string
  actualPercent: string
  status: TaskWorkStatus
  timePlannedHours: string
  timeSpentHours: string
  outputDeliverable: string
}

export interface FlaggableRowState {
  key: string
  description: string
  flagged: boolean
}

export interface ReportFormState {
  weekStart: string
  projectId: string
  tasks: TaskRowState[]
  tasksPlannedNextWeek: string
  blockers: FlaggableRowState[]
  achievements: FlaggableRowState[]
  /** Keyed by TaskType; '' means "not filled in" and is omitted from the payload. */
  hours: Record<TaskType, string>
  notes: string
  links: string
}

let keyCounter = 0
export function nextKey(prefix: string): string {
  keyCounter += 1
  return `${prefix}-${keyCounter}`
}

export function emptyTaskRow(): TaskRowState {
  return {
    key: nextKey('task'),
    taskName: '',
    priority: 'MEDIUM',
    plannedPercent: '',
    actualPercent: '',
    status: 'IN_PROGRESS',
    timePlannedHours: '',
    timeSpentHours: '',
    outputDeliverable: '',
  }
}

export function emptyFlaggableRow(prefix: string): FlaggableRowState {
  return { key: nextKey(prefix), description: '', flagged: false }
}

function emptyHours(): Record<TaskType, string> {
  return { DEVELOPMENT: '', TESTING: '', MEETINGS: '', DOCUMENTATION: '', OTHER: '' }
}

export function blankForm(weekStart: string): ReportFormState {
  return {
    weekStart,
    projectId: '',
    tasks: [emptyTaskRow()],
    tasksPlannedNextWeek: '',
    blockers: [],
    achievements: [],
    hours: emptyHours(),
    notes: '',
    links: '',
  }
}

/** Seeds the form from an existing report's current version. */
export function formFromContent(
  content: ReportContent,
  projectId: number,
  weekStart: string,
): ReportFormState {
  const hours = emptyHours()
  content.hours.forEach((entry) => {
    hours[entry.taskType] = String(entry.hours)
  })

  return {
    weekStart,
    projectId: String(projectId),
    tasks: content.tasks.map((task) => ({
      key: nextKey('task'),
      taskName: task.taskName,
      priority: task.priority,
      plannedPercent: String(task.plannedPercent),
      actualPercent: String(task.actualPercent),
      status: task.status,
      timePlannedHours: String(task.timePlannedHours),
      timeSpentHours: String(task.timeSpentHours),
      outputDeliverable: task.outputDeliverable ?? '',
    })),
    tasksPlannedNextWeek: content.tasksPlannedNextWeek ?? '',
    blockers: content.blockers.map((blocker) => ({
      key: nextKey('blocker'),
      description: blocker.description,
      flagged: blocker.keyIssue,
    })),
    achievements: content.achievements.map((achievement) => ({
      key: nextKey('achievement'),
      description: achievement.description,
      flagged: achievement.keyAchievement,
    })),
    hours,
    notes: content.notes ?? '',
    links: content.links ?? '',
  }
}

/** A row the user added but never touched — dropped rather than failing validation on it. */
export function isBlankTaskRow(row: TaskRowState): boolean {
  return (
    row.taskName.trim() === '' &&
    row.plannedPercent === '' &&
    row.actualPercent === '' &&
    row.timePlannedHours === '' &&
    row.timeSpentHours === '' &&
    row.outputDeliverable.trim() === ''
  )
}

export function meaningfulTasks(state: ReportFormState): TaskRowState[] {
  return state.tasks.filter((row) => !isBlankTaskRow(row))
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/** Form state to the request body. Numbers are parsed here and nowhere else. */
export function toContentInput(state: ReportFormState): ReportContentInput {
  const tasks: TaskEntryInput[] = meaningfulTasks(state).map((row) => ({
    taskName: row.taskName.trim(),
    priority: row.priority,
    status: row.status,
    plannedPercent: Number(row.plannedPercent),
    actualPercent: Number(row.actualPercent),
    timePlannedHours: Number(row.timePlannedHours),
    timeSpentHours: Number(row.timeSpentHours),
    outputDeliverable: blankToNull(row.outputDeliverable),
  }))

  const blockers: BlockerInput[] = state.blockers
    .filter((row) => row.description.trim() !== '')
    .map((row) => ({ description: row.description.trim(), keyIssue: row.flagged }))

  const achievements: AchievementInput[] = state.achievements
    .filter((row) => row.description.trim() !== '')
    .map((row) => ({ description: row.description.trim(), keyAchievement: row.flagged }))

  // Blank rows are omitted entirely rather than sent as 0 - "no meetings logged" and
  // "0 hours of meetings" are different statements.
  const hours: HoursEntryInput[] = TASK_TYPES.filter((type) => state.hours[type] !== '').map(
    (type) => ({ taskType: type, hours: Number(state.hours[type]) }),
  )

  return {
    projectId: Number(state.projectId),
    tasksPlannedNextWeek: blankToNull(state.tasksPlannedNextWeek),
    notes: blankToNull(state.notes),
    links: blankToNull(state.links),
    // All four arrays are always sent. The backend's update DTO has no @NotNull on them, so
    // an omitted array is accepted and would silently wipe that section.
    tasks,
    blockers,
    achievements,
    hours,
  }
}

export type FieldErrors = Record<string, string>

function isIntegerInRange(value: string, min: number, max: number): boolean {
  if (!/^\d+$/.test(value)) return false
  const parsed = Number(value)
  return parsed >= min && parsed <= max
}

function isDecimalInRange(value: string, min: number, max: number): boolean {
  // At most two decimals: the column is DECIMAL(5,2) and MySQL silently rounds a third.
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return false
  const parsed = Number(value)
  return parsed >= min && parsed <= max
}

/**
 * Structural rules — everything the backend bean-validates. These apply even to a draft
 * save, because the backend validates a draft's payload just as strictly as a submission.
 */
export function validateStructure(state: ReportFormState, requireWeek: boolean): FieldErrors {
  const errors: FieldErrors = {}

  if (requireWeek && !state.weekStart) errors.weekStart = 'Pick the week this report covers'
  if (!state.projectId) errors.projectId = 'Choose a project'

  meaningfulTasks(state).forEach((row, index) => {
    const at = (field: string) => `tasks.${index}.${field}`
    if (row.taskName.trim() === '') errors[at('taskName')] = 'Required'
    else if (row.taskName.trim().length > 255) errors[at('taskName')] = 'Max 255 characters'

    if (!isIntegerInRange(row.plannedPercent, 0, 100)) errors[at('plannedPercent')] = '0–100'
    if (!isIntegerInRange(row.actualPercent, 0, 100)) errors[at('actualPercent')] = '0–100'
    if (!isDecimalInRange(row.timePlannedHours, 0, 999.99)) errors[at('timePlannedHours')] = '0–999.99'
    if (!isDecimalInRange(row.timeSpentHours, 0, 999.99)) errors[at('timeSpentHours')] = '0–999.99'
    if (row.outputDeliverable.length > 500) errors[at('outputDeliverable')] = 'Max 500 characters'
  })

  if (meaningfulTasks(state).length > 50) errors.tasks = 'At most 50 tasks'
  if (state.blockers.length > 20) errors.blockers = 'At most 20 blockers'
  if (state.achievements.length > 20) errors.achievements = 'At most 20 achievements'

  TASK_TYPES.forEach((type) => {
    const value = state.hours[type]
    if (value !== '' && !isDecimalInRange(value, 0, 999.99)) {
      errors[`hours.${type}`] = '0–999.99'
    }
  })

  // At most one key blocker / key achievement. The radio control makes this unreachable
  // through the UI, but the rule is checked anyway so seeded or restored state can't slip past.
  if (state.blockers.filter((row) => row.flagged).length > 1) {
    errors.blockers = 'Only one blocker can be the key issue'
  }
  if (state.achievements.filter((row) => row.flagged).length > 1) {
    errors.achievements = 'Only one achievement can be the key achievement'
  }

  return errors
}

/**
 * The two extra rules the backend applies only when submitting. Checked client-side so
 * Submit explains itself rather than round-tripping a 409.
 */
export function validateForSubmit(state: ReportFormState): FieldErrors {
  const errors: FieldErrors = {}
  if (meaningfulTasks(state).length === 0) {
    errors.tasks = 'Add at least one completed task before submitting'
  }
  if (state.tasksPlannedNextWeek.trim() === '') {
    errors.tasksPlannedNextWeek = 'Fill this in before submitting'
  }
  return errors
}

/** Mirrors the backend's submit-time completeness check, for enabling the Submit button. */
export function isSubmittable(content: ReportContent): boolean {
  return content.tasks.length > 0 && (content.tasksPlannedNextWeek ?? '').trim() !== ''
}
