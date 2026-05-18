import { ToolException } from "./errors.js"

export interface Config {
  moodleUrl: string
  moodleToken: string
  moodleRestPath: string
  verifyTls: boolean
  lookaheadDays: number
  timezone?: string
}

export function loadConfig(): Config {
  const moodleUrl = process.env.MOODLE_URL?.trim()
  const moodleToken = process.env.MOODLE_TOKEN?.trim()
  if (!moodleUrl || !moodleToken) {
    throw new ToolException("AUTH_MISSING_CREDENTIALS", "Missing MOODLE_URL or MOODLE_TOKEN")
  }
  let parsed: URL
  try {
    parsed = new URL(moodleUrl)
  } catch {
    throw new ToolException("VALIDATION_ERROR", "MOODLE_URL is not a valid URL")
  }
  const moodleRestPath = (process.env.MOODLE_REST_PATH || "/webservice/rest/server.php").trim()
  const verifyTls = (process.env.MOODLE_VERIFY_TLS || "true").toLowerCase() !== "false"
  const lookaheadDays = Number(process.env.LOOKAHEAD_DAYS || "14")
  return {
    moodleUrl: parsed.origin,
    moodleToken,
    moodleRestPath: moodleRestPath.startsWith("/") ? moodleRestPath : `/${moodleRestPath}`,
    verifyTls,
    lookaheadDays: Number.isFinite(lookaheadDays) ? lookaheadDays : 14,
    timezone: process.env.TIMEZONE,
  }
}
