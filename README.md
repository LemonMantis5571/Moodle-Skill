# Moodle Skill

Portable, agent-agnostic Moodle skill specification for assistants that can call Moodle capabilities through a tool adapter layer.

This repository is intentionally implementation-neutral: it defines behavior, workflows, and guardrails rather than binding to one specific tool server.

MCP is optional. The default design is tools-first: build a Moodle adapter that exposes canonical tool actions and returns JSON.

University-agnostic here means Moodle-instance agnostic: no hardcoded institution hostnames, IDs, language assumptions, or service assumptions.

## What This Provides

- A root-level `SKILL.md` with deterministic Moodle workflows.
- A tools-first architecture and adapter contract (CLI JSON).
- Mandatory credential onboarding prompts for users.
- Graceful degradation strategy when optional Moodle services are disabled.
- Security and output contracts for production-safe behavior.

## Architecture Summary

1. `SKILL.md` orchestrates workflow logic.
2. A Moodle tool adapter executes calls against Moodle REST APIs.
3. Agent runtime invokes tools (CLI or equivalent integration).
4. MCP can wrap these tools later, but is not required.

V1 is CLI-first and token-only.

## Tool Adapter Contract (Recommended)

Command style:

```bash
moodle-tools <tool_name> [options] --json
```

Initial tool set:

- `site_info`
- `list_courses`
- `get_course --courseId <id>`
- `list_assignments [--courseId <id>]`
- `get_submission_status --assignmentId <id>`
- `get_submissions --courseId <id>`
- `get_grades --courseId <id>`
- `get_calendar_events [--courseId <id>] [--daysAhead <n>]`

Student summary commands:

- `submitted_work --courseId <id>`
- `pending_work --courseId <id>`
- `ungraded_submissions [--courseId <id>]`
- `whats_due [--courseId <id>] [--daysAhead <n>]`

All tools must return a JSON envelope with fields:

- `ok`
- `data`
- `warnings`
- `error`
- `meta`

## V1 Configuration Surface

- `MOODLE_URL` (required)
- `MOODLE_TOKEN` (required)
- `MOODLE_REST_PATH` (optional, default `/webservice/rest/server.php`)
- `MOODLE_VERIFY_TLS` (optional, default `true`; set `false` only for controlled development)
- `LOOKAHEAD_DAYS` (optional)
- `TIMEZONE` (optional)

Endpoint resolution is always: `MOODLE_URL + MOODLE_REST_PATH`.

## Required Inputs

- `MOODLE_URL` - Base Moodle URL, for example `https://campus.school.edu`
- `MOODLE_TOKEN` - Token from `Moodle mobile web service`

Recommended optional inputs:

- `TIMEZONE`
- `LOOKAHEAD_DAYS`

## Quickstart

1. Configure your agent runtime with `MOODLE_URL` and `MOODLE_TOKEN`.
2. Build or install a Moodle tool adapter that matches the tool contract.
3. Load `SKILL.md` in your runtime's skill/instruction mechanism.
4. Run preflight checks:
   - `site_info`
   - `list_courses`
5. Execute workflows:
   - `whats_due`
   - `course_digest`
   - `submitted_work`
   - `pending_work`
   - `ungraded_submissions`
   - `exam_prep`
   - `build_study_notes`

## How Users Get Credentials

### Moodle URL

- Open Moodle in browser.
- Copy only the base domain.
- Example: from `https://campus.school.edu/user/managetoken.php`, use `https://campus.school.edu`.

### Moodle Token

- Go to Moodle Profile or Preferences -> Security keys.
- Copy token for `Moodle mobile web service`.

If only a `VPL web service` token is visible, test it first but expect limited API coverage.

## Troubleshooting

- Wrong host or non-Moodle endpoint: verify `MOODLE_URL` points to Moodle base URL.
- Custom install path: set `MOODLE_REST_PATH` correctly and retry preflight.
- Invalid token: regenerate token and retry preflight.
- TLS/certificate issues: fix cert chain; use `MOODLE_VERIFY_TLS=false` only in development.
- Token works but missing grades/quizzes/forums: admin likely has those services disabled.
- VPL token limited scope: request token for `Moodle mobile web service`.
- Valid token but missing function: return `SERVICE_DISABLED` or `PERMISSION_DENIED` with capability details.
- Missing credentials: agent must trigger credential collection prompt before any workflow.

## Files

- `SKILL.md` - Main skill definition.
- `capability-matrix.md` - Capability requirements and fallback behavior.

## Next Build Step

If you are starting from zero integration, implement the tool adapter first. The skill is orchestration-only and depends on callable Moodle tools.

Recommended build order:

1. Connection validation and diagnostics.
2. Capability discovery and adaptive function mapping.
3. Core low-level commands.
4. Student summary commands (`submitted_work`, `pending_work`, `ungraded_submissions`, `whats_due`).
