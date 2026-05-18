# Moodle Capability Matrix

This matrix defines capability expectations for agent-agnostic Moodle workflows.

Transport note: capabilities can be provided by any adapter (CLI, local service, MCP wrapper). The skill targets capability names, not transport.

Discovery note: adapters should discover available Moodle functions during preflight and map logical capabilities to preferred or fallback functions.

Preferred mapping policy:

- inspect `site_info.functions`
- use preferred function first
- use fallback if preferred is unavailable
- return `SERVICE_DISABLED` or `PERMISSION_DENIED` if no mapping is viable

| Capability | Preferred Function(s) | Fallback Function(s) | Required Level | Fallback Behavior |
|---|---|---|---|---|
| `site_info` | `core_webservice_get_site_info` | none | Core | Fail workflow if unavailable; prompt credential validation |
| `list_courses` | `core_enrol_get_users_courses` | none | Core | Fail workflow if unavailable; prompt token scope/admin check |
| `get_course` | `core_course_get_courses_by_field` | `core_course_get_contents` | Core | Continue with reduced summaries |
| `list_resources` | course content APIs | section/module data from `get_course` | Core | Build digest without file-level details |
| `download_file` | pluginfile access + content endpoint | none | Core for note building | Skip unreadable files; report skipped list |
| `list_assignments` | `mod_assign_get_assignments` | assignment metadata from course modules | Optional | Use calendar-only due tracking |
| `get_assignment` | `mod_assign_get_assignments` | submission metadata where available | Optional | Omit submission/feedback detail |
| `get_submission_status` | `mod_assign_get_submission_status` | assignment-level submission fields | Optional | Infer status from available fields; return assignment-scoped result |
| `get_submissions` | `mod_assign_get_submissions` | `get_submission_status` + assignment metadata | Optional | Return assignment-scoped details only; course-wide views belong to summary commands |
| `get_grades` | `gradereport_user_get_grade_items` | `core_grades_get_grades`, then assignment feedback grade signals | Optional | Use full gradebook when possible; otherwise return partial grade signals with confidence warning |
| `get_calendar_events` | `core_calendar_get_action_events_by_timesort` | `core_calendar_get_calendar_events` | Optional | Use assignment due dates only |
| `list_quizzes` | `mod_quiz` functions | none | Optional | Exam prep excludes quiz evidence |
| `get_quiz_attempts` | `mod_quiz` functions | none | Optional | Exam prep excludes attempt-level trends |
| `list_forums` | `mod_forum` functions | none | Optional | Digest excludes forum activity |
| `get_forum_discussions` | `mod_forum` functions | none | Optional | Digest excludes discussion-level detail |
| `get_notifications` | messaging services | none | Optional | Digest excludes notification stream |
| `submitted_work` | assignment + submission capabilities | assignment-level summaries | Summary command | Return best-effort normalized output with data gaps |
| `pending_work` | assignment + submission capabilities | due-date heuristics | Summary command | Use heuristics if submission state unavailable |
| `ungraded_submissions` | submission + grade capabilities | submission feedback metadata | Summary command | Return probable ungraded list with confidence warning |

## User-Facing Warning Templates

- Missing core capability:
  - "I cannot continue because a required Moodle capability is unavailable. Please verify your token scope and Moodle web service access."
- Missing optional capability:
  - "I continued with partial data because `<capability>` is unavailable. Results may omit some Moodle details."
- Likely limited token scope:
  - "Your token appears to have limited scope (for example VPL-only). Please generate a token for Moodle mobile web service for full coverage."

## Partial Data Confidence Rules

- If preferred mapping succeeds, confidence is high.
- If fallback mapping is used, include warning noting reduced confidence.
- If inferred from heuristics only, include explicit low-confidence warning in each affected row.

## Grade Fallback Expectations

- If `gradereport_user_get_grade_items` is available, treat grade confidence as high.
- If `core_grades_get_grades` is used, treat confidence as medium and include source warning.
- If only assignment/submission grade signals are available, treat confidence as low and mark output as partial.
- If no grade source exists, `get_grades` returns `SERVICE_DISABLED` while summary commands continue with non-grade data.

## Connection Diagnostic Templates

- Wrong host or endpoint:
  - "The configured Moodle endpoint does not look valid. Check MOODLE_URL and MOODLE_REST_PATH."
- TLS or certificate issue:
  - "TLS verification failed for the Moodle host. Fix certificate trust or set MOODLE_VERIFY_TLS=false only for local development."
- Valid token, missing function:
  - "Authentication succeeded, but this capability is not available for your token/site configuration."
