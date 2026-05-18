# Moodle Capability Matrix

This matrix defines capability expectations for agent-agnostic Moodle workflows.

Transport note: capabilities can be provided by any adapter (CLI, local service, MCP wrapper). The skill targets capability names, not transport.

Discovery note: adapters should discover available Moodle functions during preflight and map logical capabilities to preferred or fallback functions.

| Capability | Typical Moodle Service Dependency | Required Level | Fallback Behavior |
|---|---|---|---|
| `site_info` | core web service | Core | Fail workflow if unavailable; prompt credential validation |
| `list_courses` | core web service | Core | Fail workflow if unavailable; prompt token scope/admin check |
| `get_course` | core course APIs | Core | Continue with reduced summaries |
| `list_resources` | core content APIs | Core | Build digest without file-level details |
| `download_file` | pluginfile access + content endpoint | Core for note building | Skip unreadable files; report skipped list |
| `list_assignments` | `mod_assign` | Optional | Use calendar-only due tracking |
| `get_assignment` | `mod_assign` | Optional | Omit submission/feedback detail |
| `get_submission_status` | `mod_assign` + submission APIs | Optional | Infer from assignment-level fields when available |
| `get_submissions` | `mod_assign` + submission APIs | Optional | Return limited summaries from assignment metadata |
| `get_grades` | `gradereport_user` | Optional | Infer weak areas from quizzes/assignments only |
| `get_calendar_events` | `core_calendar` | Optional | Use assignment due dates only |
| `list_quizzes` | `mod_quiz` | Optional | Exam prep excludes quiz evidence |
| `get_quiz_attempts` | `mod_quiz` | Optional | Exam prep excludes attempt-level trends |
| `list_forums` | `mod_forum` | Optional | Digest excludes forum activity |
| `get_forum_discussions` | `mod_forum` | Optional | Digest excludes discussion-level detail |
| `get_notifications` | messaging services | Optional | Digest excludes notification stream |
| `submitted_work` | assignment + submission capabilities | Summary command | Return best-effort normalized output with data gaps |
| `pending_work` | assignment + submission capabilities | Summary command | Use due-date heuristics if submission state unavailable |
| `ungraded_submissions` | submission + grade capabilities | Summary command | Return probable ungraded list with confidence warning |

## User-Facing Warning Templates

- Missing core capability:
  - "I cannot continue because a required Moodle capability is unavailable. Please verify your token scope and Moodle web service access."
- Missing optional capability:
  - "I continued with partial data because `<capability>` is unavailable. Results may omit some Moodle details."
- Likely limited token scope:
  - "Your token appears to have limited scope (for example VPL-only). Please generate a token for Moodle mobile web service for full coverage."

## Connection Diagnostic Templates

- Wrong host or endpoint:
  - "The configured Moodle endpoint does not look valid. Check MOODLE_URL and MOODLE_REST_PATH."
- TLS or certificate issue:
  - "TLS verification failed for the Moodle host. Fix certificate trust or set MOODLE_VERIFY_TLS=false only for local development."
- Valid token, missing function:
  - "Authentication succeeded, but this capability is not available for your token/site configuration."
