/**
 * Mirrors the backend DTOs in
 * backend/weekly-report-backend/src/main/java/com/technical/task/weeklyreportbackend/dto.
 * Kept in sync by hand — if you change a DTO there, change it here.
 *
 * Backend enums are string-literal unions rather than TypeScript enums: this project
 * compiles with `erasableSyntaxOnly`, which rules `enum` out, and unions serialise to
 * exactly the strings the API sends anyway.
 */

export type Role = 'TEAM_MEMBER' | 'MANAGER'

export type ReportStatus = 'DRAFT' | 'SUBMITTED' | 'NEEDS_CORRECTION' | 'APPROVED'

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export type TaskWorkStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' | 'BLOCKED'

export type TaskType = 'DEVELOPMENT' | 'TESTING' | 'MEETINGS' | 'DOCUMENTATION' | 'OTHER'

export type ReviewAction = 'APPROVE' | 'REQUEST_CHANGES'

export interface AuthResponse {
  token: string
  userId: number
  name: string
  email: string
  role: Role
}

export interface UserSummary {
  id: number
  name: string
}

export interface ProjectSummary {
  id: number
  name: string
}

export interface TaskEntry {
  id: number
  displayOrder: number
  taskName: string
  priority: TaskPriority
  status: TaskWorkStatus
  plannedPercent: number
  actualPercent: number
  timePlannedHours: number
  timeSpentHours: number
  outputDeliverable: string | null
}

export interface Blocker {
  id: number
  displayOrder: number
  description: string
  keyIssue: boolean
}

export interface Achievement {
  id: number
  displayOrder: number
  description: string
  keyAchievement: boolean
}

export interface HoursEntry {
  taskType: TaskType
  hours: number
}

export interface ReviewComment {
  id: number
  versionNumber: number
  reviewer: UserSummary
  action: ReviewAction
  comment: string | null
  createdAt: string
}

/** `submittedAt === null` means this is the open working copy rather than a frozen snapshot. */
export interface ReportContent {
  versionNumber: number
  submittedAt: string | null
  tasksPlannedNextWeek: string | null
  notes: string | null
  links: string | null
  tasks: TaskEntry[]
  blockers: Blocker[]
  achievements: Achievement[]
  hours: HoursEntry[]
}

export interface ReportDetail {
  id: number
  owner: UserSummary
  project: ProjectSummary
  weekStart: string
  weekEnd: string
  status: ReportStatus
  lastSubmittedAt: string | null
  createdAt: string
  updatedAt: string
  content: ReportContent
  latestReviewComment: ReviewComment | null
  reviewHistory: ReviewComment[]
  submittedVersionCount: number
  editable: boolean
  reviewable: boolean
}

export interface ReportSummary {
  id: number
  owner: UserSummary
  project: ProjectSummary
  weekStart: string
  weekEnd: string
  status: ReportStatus
  lastSubmittedAt: string | null
  updatedAt: string
}

export interface ReportVersionSummary {
  versionNumber: number
  submittedAt: string | null
  reviews: ReviewComment[]
}

export interface ReportVersionDetail {
  reportId: number
  owner: UserSummary
  project: ProjectSummary
  weekStart: string
  weekEnd: string
  reportStatus: ReportStatus
  content: ReportContent
  reviews: ReviewComment[]
}

/** `status === null` is the brief's "not yet started" — no report row exists for that week. */
export interface WeekStatus {
  member: UserSummary
  reportId: number | null
  status: ReportStatus | null
}

export interface PageResponse<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

// ---- request payloads ----

export interface TaskEntryInput {
  taskName: string
  priority: TaskPriority
  status: TaskWorkStatus
  plannedPercent: number
  actualPercent: number
  timePlannedHours: number
  timeSpentHours: number
  outputDeliverable?: string | null
}

export interface BlockerInput {
  description: string
  keyIssue: boolean
}

export interface AchievementInput {
  description: string
  keyAchievement: boolean
}

export interface HoursEntryInput {
  taskType: TaskType
  hours: number
}

export interface ReportContentInput {
  projectId: number
  tasksPlannedNextWeek?: string | null
  notes?: string | null
  links?: string | null
  tasks: TaskEntryInput[]
  blockers: BlockerInput[]
  achievements: AchievementInput[]
  hours: HoursEntryInput[]
}

export interface CreateReportInput extends ReportContentInput {
  weekStart: string
}

export interface ReportFilters {
  userId?: number
  projectId?: number
  status?: ReportStatus[]
  weekStart?: string
  weekFrom?: string
  weekTo?: string
  page?: number
  size?: number
  sort?: string
}
// ---- projects & users (manager administration) ----

/** `reportCount` is what decides whether a project can be deleted or only deactivated. */
export interface ProjectDetail {
  id: number
  name: string
  description: string | null
  active: boolean
  reportCount: number
}

export interface CreateProjectInput {
  name: string
  description?: string | null
}

export interface UpdateProjectInput {
  name: string
  description?: string | null
  active: boolean
}

/** The manager's view of an account — the one list that exposes email, deliberately. */
export interface UserDetail {
  id: number
  name: string
  email: string
  role: Role
  enabled: boolean
  reportCount: number
  createdAt: string
}

export interface CreateUserInput {
  name: string
  email: string
  password: string
  role: Role
}

/** Name and email are not editable here — the endpoint administers access, not identity. */
export interface UpdateUserInput {
  role: Role
  enabled: boolean
}

// ---- dashboard aggregates ----

/**
 * `needsCorrection` and `openBlockers` are current-state counts across the whole team, not
 * week-scoped — see the DTO's note. The tiles have to label them that way.
 */
export interface DashboardSummary {
  weekStart: string
  weekEnd: string
  teamSize: number
  submitted: number
  draft: number
  notStarted: number
  compliancePercent: number
  needsCorrection: number
  openBlockers: number
}

export interface TasksCompletedPoint {
  weekStart: string
  completedTasks: number
}

/** Statuses with no reports are absent from `counts` rather than zero — hence Partial. */
export interface MemberStatusBreakdown {
  member: UserSummary
  counts: Partial<Record<ReportStatus, number>>
}

export interface ProjectWorkloadPoint {
  projectId: number
  projectName: string
  reportCount: number
  /** BigDecimal on the wire: a JSON number, but read it through Number() before arithmetic. */
  hoursSpent: number
}

export interface TaskTypeHoursPoint {
  taskType: TaskType
  hours: number
}

export interface DashboardCharts {
  tasksCompletedTrend: TasksCompletedPoint[]
  statusByMember: MemberStatusBreakdown[]
  workloadByProject: ProjectWorkloadPoint[]
  hoursByTaskType: TaskTypeHoursPoint[]
}

export type ActivityType = 'SUBMITTED' | 'APPROVED' | 'CHANGES_REQUESTED'

export interface ActivityItem {
  type: ActivityType
  reportId: number
  weekStart: string
  /** Whose report it is. */
  owner: UserSummary
  /** Who acted — the owner for a submission, the manager for a review. */
  actor: UserSummary
  projectName: string
  versionNumber: number | null
  comment: string | null
  at: string
}

// ---- AI chat assistant (optional feature) ----

/** Asked before the widget renders, so an unconfigured deployment shows why rather than failing. */
export interface AssistantStatus {
  configured: boolean
  model: string
}

/** `role` is whitelisted server-side to these two values — they are what the provider accepts. */
export interface AssistantTurn {
  role: 'user' | 'model'
  text: string
}

export interface AssistantChatInput {
  message: string
  history: AssistantTurn[]
}

/**
 * `toolsUsed` is shown in the UI on purpose: it is what makes an answer checkable. Seeing that
 * a number came from `list_reports` rather than from the model's own recollection is the
 * difference between a figure a manager can act on and one they have to go and verify.
 */
export interface AssistantChatResult {
  reply: string
  toolsUsed: string[]
}

export interface AssistantSummary {
  weekStart: string
  weekEnd: string
  reportsIncluded: number
  summary: string
}
