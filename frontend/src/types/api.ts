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
