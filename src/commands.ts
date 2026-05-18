import type { Config } from "./config.js"
import { ToolException, toToolError } from "./errors.js"
import { MoodleClient } from "./moodle.js"
import type { SummaryRow, ToolResult } from "./types.js"

type AnyData = Record<string, unknown> | Array<unknown>

function result(tool: string, start: number, ok: boolean, data: AnyData | null, warnings: string[], error: ToolException | null, partial = false): ToolResult {
  return {
    ok,
    data,
    warnings,
    error: error ? toToolError(error) : null,
    meta: {
      tool,
      source: "moodle-rest",
      latencyMs: Date.now() - start,
      partial,
      timestamp: new Date().toISOString(),
    },
  }
}

function normalizeSummaryRow(input: Record<string, unknown>): SummaryRow {
  const files = Array.isArray(input.attachedFiles) ? input.attachedFiles.filter((v): v is string => typeof v === "string") : []
  return {
    courseId: Number(input.courseId || 0),
    courseName: String(input.courseName || ""),
    assignmentId: Number(input.assignmentId || 0),
    assignmentName: String(input.assignmentName || ""),
    dueAt: input.dueAt ? String(input.dueAt) : null,
    submissionStatus: String(input.submissionStatus || "unknown"),
    submittedAt: input.submittedAt ? String(input.submittedAt) : null,
    submissionMode: (input.submissionMode as SummaryRow["submissionMode"]) || "unknown",
    attachedFiles: files,
    submissionTextPresent: Boolean(input.submissionTextPresent),
    gradingStatus: String(input.gradingStatus || "unknown"),
    gradeDisplayRaw: input.gradeDisplayRaw ? String(input.gradeDisplayRaw) : null,
    gradeNumeric: typeof input.gradeNumeric === "number" ? input.gradeNumeric : undefined,
    gradeScaleMax: typeof input.gradeScaleMax === "number" ? input.gradeScaleMax : undefined,
    warnings: Array.isArray(input.warnings) ? input.warnings.map(String) : [],
  }
}

async function getGradesWithFallback(client: MoodleClient, courseId: number): Promise<{ data: AnyData; warnings: string[]; partial: boolean }> {
  const warnings: string[] = []
  try {
    const primary = await client.call("gradereport_user_get_grade_items", { courseid: courseId })
    return { data: primary, warnings, partial: false }
  } catch {
    warnings.push("Primary gradebook function unavailable; using fallback.")
  }
  try {
    const fallback = await client.call("core_grades_get_grades", { courseid: courseId })
    return { data: fallback, warnings, partial: true }
  } catch {
    warnings.push("Secondary grade function unavailable; using assignment grade signals.")
  }
  const assignments = await client.call("mod_assign_get_assignments", { courseids: [courseId] })
  return { data: assignments, warnings, partial: true }
}

export async function executeCommand(command: string, args: Record<string, string>, cfg: Config): Promise<ToolResult> {
  const start = Date.now()
  const client = new MoodleClient(cfg)
  const warnings: string[] = []
  try {
    await client.discoverFunctions()

    if (command === "site_info") {
      const data = await client.call("core_webservice_get_site_info", {})
      return result(command, start, true, data, warnings, null)
    }

    if (command === "list_courses") {
      const site = await client.call("core_webservice_get_site_info", {})
      const userId = Number(site.userid || 0)
      const data = await client.call("core_enrol_get_users_courses", { userid: userId })
      return result(command, start, true, data as unknown as AnyData, warnings, null)
    }

    if (command === "get_submission_status") {
      const assignmentId = Number(args.assignmentId)
      if (!assignmentId) throw new ToolException("VALIDATION_ERROR", "assignmentId is required")
      const data = await client.call("mod_assign_get_submission_status", { assignid: assignmentId })
      return result(command, start, true, data, warnings, null)
    }

    if (command === "get_submissions") {
      const assignmentId = Number(args.assignmentId)
      if (!assignmentId) throw new ToolException("VALIDATION_ERROR", "assignmentId is required")
      let data: AnyData
      try {
        data = await client.call("mod_assign_get_submissions", { assignmentids: [assignmentId] })
      } catch {
        warnings.push("Falling back to get_submission_status due to limited capability.")
        data = await client.call("mod_assign_get_submission_status", { assignid: assignmentId })
      }
      return result(command, start, true, data, warnings, null, warnings.length > 0)
    }

    if (command === "get_grades") {
      const courseId = Number(args.courseId)
      if (!courseId) throw new ToolException("VALIDATION_ERROR", "courseId is required")
      const { data, warnings: gw, partial } = await getGradesWithFallback(client, courseId)
      return result(command, start, true, data, gw, null, partial)
    }

    if (command === "get_course") {
      const courseId = Number(args.courseId)
      if (!courseId) throw new ToolException("VALIDATION_ERROR", "courseId is required")
      let data: AnyData
      try {
        data = await client.call("core_course_get_courses_by_field", { field: "id", value: courseId })
      } catch {
        warnings.push("Using fallback core_course_get_contents.")
        data = await client.call("core_course_get_contents", { courseid: courseId })
      }
      return result(command, start, true, data, warnings, null, warnings.length > 0)
    }

    if (command === "list_assignments") {
      const courseId = args.courseId ? Number(args.courseId) : undefined
      const data = await client.call("mod_assign_get_assignments", courseId ? { courseids: [courseId] } : {})
      return result(command, start, true, data, warnings, null)
    }

    if (command === "get_calendar_events") {
      const courseId = args.courseId ? Number(args.courseId) : undefined
      const daysAhead = Number(args.daysAhead || cfg.lookaheadDays)
      const now = Math.floor(Date.now() / 1000)
      const future = now + daysAhead * 24 * 60 * 60
      let data: AnyData
      try {
        data = await client.call("core_calendar_get_action_events_by_timesort", { limitnum: 200, timesortfrom: now, timesortto: future })
      } catch {
        warnings.push("Using fallback calendar function.")
        data = await client.call("core_calendar_get_calendar_events", {
          events: { timestart: now, timeend: future },
        })
      }
      if (courseId) warnings.push("Course filtering may be partial depending on Moodle response shape.")
      return result(command, start, true, data, warnings, null, warnings.length > 0)
    }

    if (command === "submitted_work" || command === "pending_work" || command === "ungraded_submissions" || command === "whats_due") {
      const courseId = Number(args.courseId)
      if (!courseId) throw new ToolException("VALIDATION_ERROR", "courseId is required for summary commands")
      const assignRaw = await client.call("mod_assign_get_assignments", { courseids: [courseId] })
      const assignments = (((assignRaw.courses as Array<Record<string, unknown>> | undefined)?.[0]?.assignments as Array<Record<string, unknown>>) || [])
      const rows: SummaryRow[] = []
      for (const a of assignments) {
        const row = normalizeSummaryRow({
          courseId,
          courseName: String(((assignRaw.courses as Array<Record<string, unknown>> | undefined)?.[0]?.fullname as string) || ""),
          assignmentId: Number(a.id || 0),
          assignmentName: String(a.name || ""),
          dueAt: a.duedate ? new Date(Number(a.duedate) * 1000).toISOString() : null,
          submissionStatus: "unknown",
          submittedAt: null,
          submissionMode: "unknown",
          attachedFiles: [],
          submissionTextPresent: false,
          gradingStatus: "unknown",
          gradeDisplayRaw: null,
          warnings: [],
        })
        try {
          const status = await client.call("mod_assign_get_submission_status", { assignid: row.assignmentId })
          const last = status.lastattempt as Record<string, unknown> | undefined
          const submission = last?.submission as Record<string, unknown> | undefined
          row.submissionStatus = String(submission?.status || "unknown")
          if (submission) {
            const plugins = submission.plugins as Array<Record<string, unknown>> | undefined
            const filePlugins = (plugins || []).filter((p) => p.type === "file")
            const txtPlugins = (plugins || []).filter((p) => p.type === "onlinetext")
            row.submissionMode = filePlugins.length && txtPlugins.length ? "mixed" : filePlugins.length ? "file" : txtPlugins.length ? "online_text" : "unknown"
            row.submissionTextPresent = txtPlugins.length > 0
            const files: string[] = []
            for (const fp of filePlugins) {
              const editorfields = fp.editorfields as Array<Record<string, unknown>> | undefined
              for (const ef of editorfields || []) {
                const farr = ef.files as Array<Record<string, unknown>> | undefined
                for (const f of farr || []) {
                  if (typeof f.filename === "string") files.push(f.filename)
                }
              }
            }
            row.attachedFiles = files
          }
        } catch {
          row.warnings.push("Submission detail unavailable")
        }
        rows.push(row)
      }

      let filtered = rows
      if (command === "submitted_work") filtered = rows.filter((r) => r.submissionStatus === "submitted")
      if (command === "pending_work") filtered = rows.filter((r) => r.submissionStatus !== "submitted")
      if (command === "ungraded_submissions") filtered = rows.filter((r) => r.submissionStatus === "submitted" && r.gradingStatus !== "graded")
      if (command === "whats_due") filtered = rows.sort((a, b) => (a.dueAt || "").localeCompare(b.dueAt || ""))

      return result(command, start, true, filtered, warnings, null, rows.some((r) => r.warnings.length > 0))
    }

    throw new ToolException("NOT_FOUND", `Unknown command: ${command}`)
  } catch (error) {
    const t = error instanceof ToolException ? error : new ToolException("INTERNAL_ERROR", "Unexpected internal error")
    return result(command, start, false, null, warnings, t)
  }
}
