export type ErrorCode =
  | "AUTH_MISSING_CREDENTIALS"
  | "AUTH_INVALID_TOKEN"
  | "VALIDATION_ERROR"
  | "SERVICE_DISABLED"
  | "PERMISSION_DENIED"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_ERROR"
  | "TLS_ERROR"
  | "WRONG_HOST"
  | "ENDPOINT_NOT_FOUND"
  | "INTERNAL_ERROR"

export interface ToolError {
  code: ErrorCode
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}

export interface ToolMeta {
  tool: string
  source: "moodle-rest"
  latencyMs: number
  partial: boolean
  timestamp: string
}

export interface ToolResult<T = unknown> {
  ok: boolean
  data: T | null
  warnings: string[]
  error: ToolError | null
  meta: ToolMeta
}

export type CapabilityName =
  | "site_info"
  | "list_courses"
  | "get_course"
  | "list_assignments"
  | "get_submission_status"
  | "get_submissions"
  | "get_grades"
  | "get_calendar_events"

export type SummaryCommand = "submitted_work" | "pending_work" | "ungraded_submissions" | "whats_due"

export interface SummaryRow {
  courseId: number
  courseName: string
  assignmentId: number
  assignmentName: string
  dueAt: string | null
  submissionStatus: string
  submittedAt: string | null
  submissionMode: "file" | "online_text" | "mixed" | "unknown"
  attachedFiles: string[]
  submissionTextPresent: boolean
  gradingStatus: string
  gradeDisplayRaw: string | null
  gradeNumeric?: number
  gradeScaleMax?: number
  warnings: string[]
}
