import { ToolException } from "./errors.js"
import type { CapabilityName } from "./types.js"
import type { Config } from "./config.js"

type Json = Record<string, unknown>

const CAPABILITY_MAP: Record<CapabilityName, string[]> = {
  site_info: ["core_webservice_get_site_info"],
  list_courses: ["core_enrol_get_users_courses"],
  get_course: ["core_course_get_courses_by_field", "core_course_get_contents"],
  list_assignments: ["mod_assign_get_assignments"],
  get_submission_status: ["mod_assign_get_submission_status"],
  get_submissions: ["mod_assign_get_submissions", "mod_assign_get_submission_status"],
  get_grades: ["gradereport_user_get_grade_items", "core_grades_get_grades"],
  get_calendar_events: ["core_calendar_get_action_events_by_timesort", "core_calendar_get_calendar_events"],
}

export class MoodleClient {
  private functions = new Set<string>()

  constructor(private cfg: Config) {
    if (!cfg.verifyTls) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
  }

  endpoint(): string {
    return `${this.cfg.moodleUrl}${this.cfg.moodleRestPath}`
  }

  async discoverFunctions(): Promise<void> {
    const info = await this.call("core_webservice_get_site_info", {})
    const fn = info?.functions
    if (Array.isArray(fn)) {
      for (const item of fn) {
        const name = (item as Json).name
        if (typeof name === "string") this.functions.add(name)
      }
    }
  }

  resolveFunction(capability: CapabilityName): { fn: string; fallbackUsed: boolean } {
    const options = CAPABILITY_MAP[capability]
    for (let i = 0; i < options.length; i++) {
      const f = options[i]
      if (this.functions.size === 0 || this.functions.has(f)) {
        return { fn: f, fallbackUsed: i > 0 }
      }
    }
    throw new ToolException("SERVICE_DISABLED", `No viable Moodle function for capability ${capability}`)
  }

  async call(wsfunction: string, params: Record<string, unknown>): Promise<Json> {
    const body = new URLSearchParams()
    body.set("wstoken", this.cfg.moodleToken)
    body.set("wsfunction", wsfunction)
    body.set("moodlewsrestformat", "json")
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue
      body.set(k, String(v))
    }
    let res: Response
    try {
      res = await fetch(this.endpoint(), { method: "POST", body })
    } catch (error) {
      throw new ToolException("UPSTREAM_ERROR", "Failed to reach Moodle endpoint", true, { reason: `${error}` })
    }
    if (!res.ok) {
      if (res.status === 404) throw new ToolException("ENDPOINT_NOT_FOUND", "Moodle REST endpoint was not found")
      throw new ToolException("UPSTREAM_ERROR", `Moodle HTTP error ${res.status}`, res.status >= 500)
    }
    const json = (await res.json()) as Json
    if (json.exception || json.errorcode) {
      const msg = String(json.message || "Moodle API error")
      if (msg.toLowerCase().includes("invalidtoken")) {
        throw new ToolException("AUTH_INVALID_TOKEN", "Invalid or expired Moodle token")
      }
      if (msg.toLowerCase().includes("access control exception")) {
        throw new ToolException("PERMISSION_DENIED", msg)
      }
      throw new ToolException("UPSTREAM_ERROR", msg)
    }
    return json
  }
}
