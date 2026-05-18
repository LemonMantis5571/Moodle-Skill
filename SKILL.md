---
name: moodle-agentic-skill
description: Use when users ask about Moodle courses, assignments, deadlines, grades, quizzes, forums, or study-note generation from LMS materials.
---

# Moodle Agentic Skill

## Overview

This skill defines a portable, agent-agnostic operating pattern for Moodle workflows.
It is designed to work with any runtime (Codex, Claude Code, or similar) that can call Moodle capabilities through a tool adapter layer.

This skill does not require MCP. MCP can be used as one transport option, but the default architecture is tools-first.

Core principle: enforce credential preflight first, then run deterministic workflows with graceful degradation when optional Moodle services are unavailable.

## Architecture

Use this architecture by default:

1. `SKILL.md` is the orchestration layer.
2. A Moodle tool adapter is the execution layer.
3. The adapter exposes canonical tools (for example `site_info`, `list_courses`, `get_grades`).
4. The adapter can be invoked via CLI JSON commands.
5. MCP is optional and should be treated as a wrapper, not a requirement.

## When to Use

Use this skill when the user asks to:

- List courses or summarize a class.
- Check upcoming deadlines and calendar events.
- Review grades, assignment feedback, or quiz history.
- Build study notes from Moodle files.
- Plan exam preparation from LMS performance data.

## When NOT to Use

Do not use this skill when:

- The request is not Moodle-related.
- The user asks for direct admin-only Moodle configuration changes you cannot perform.
- Required credentials are unavailable and the user declines to provide them.

## Required Inputs (Hard Gate)

Required:

- `MOODLE_URL` - Moodle base URL, for example `https://campus.school.edu`
- `MOODLE_TOKEN` - Moodle web service token (prefer token from `Moodle mobile web service`)

Optional:

- `TIMEZONE` - used for due-date normalization
- `LOOKAHEAD_DAYS` - default event horizon for deadline workflows

If required inputs are missing, stop workflow execution and run the credential collection prompt.

## Credential Collection Prompt (Mandatory)

Use this exact block when credentials are missing:

```text
To connect your Moodle account, I need two values:

1) MOODLE_URL
   - Open Moodle in your browser.
   - Copy only the base site URL.
   - Example: if you are at https://campus.school.edu/user/managetoken.php,
     your MOODLE_URL is https://campus.school.edu

2) MOODLE_TOKEN
   - In Moodle, go to Profile/Preferences > Security keys (or user/managetoken.php).
   - Copy the token for "Moodle mobile web service".

If you only see a VPL web service token, share it and I will test compatibility,
but it may have limited scope for courses/grades/assignments.
```

## Canonical Capability Model

Map runtime tool names into these logical capabilities:

- `site_info`
- `list_courses`
- `get_course`
- `list_resources`
- `download_file`
- `list_assignments`
- `get_assignment`
- `get_grades`
- `get_calendar_events`
- `list_quizzes`
- `get_quiz_attempts`
- `list_forums`
- `get_forum_discussions`
- `get_notifications`

If your runtime uses different tool names, add an adapter mapping and keep workflow logic unchanged.

## Tool Adapter Contract

The recommended adapter surface is a CLI returning JSON-only responses:

```text
moodle-tools site_info --json
moodle-tools list_courses --json
moodle-tools get_course --courseId 42 --json
moodle-tools list_assignments --courseId 42 --json
moodle-tools get_grades --courseId 42 --json
moodle-tools get_calendar_events --courseId 42 --daysAhead 14 --json
```

Required envelope for every tool response:

- `ok` (boolean)
- `data` (object, array, or null)
- `warnings` (string array)
- `error` (null or object with `code`, `message`, `retryable`, optional `details`)
- `meta` (object with `tool`, `source`, `latencyMs`, `partial`, `timestamp`)

Canonical error codes:

- `AUTH_MISSING_CREDENTIALS`
- `AUTH_INVALID_TOKEN`
- `VALIDATION_ERROR`
- `SERVICE_DISABLED`
- `PERMISSION_DENIED`
- `NOT_FOUND`
- `RATE_LIMITED`
- `UPSTREAM_ERROR`
- `INTERNAL_ERROR`

## Preflight Pattern

Before any workflow:

1. Validate `MOODLE_URL` and `MOODLE_TOKEN` are present.
2. Call `site_info` to validate auth and reachable Moodle host.
3. Call `list_courses` to validate user scope.
4. Continue only if both checks succeed.

If checks fail, return an actionable setup message and stop.

## Workflow Playbooks

### 1) whats_due

Goal: provide a prioritized deadline queue.

Steps:

1. Run preflight.
2. Pull calendar events for next `LOOKAHEAD_DAYS` (default 14).
3. Pull assignments per course when available.
4. Normalize timestamps to `TIMEZONE` (or system timezone).
5. Rank items by urgency and grade impact when known.
6. Output concise action queue with date, course, item, and urgency.

Fallbacks:

- If calendar service unavailable, use assignments only.
- If assignments unavailable, use calendar only.

### 2) course_digest

Goal: summarize status of one or more courses.

Steps:

1. Run preflight.
2. Pull course structure and resources.
3. Pull upcoming deadlines (calendar/assignments).
4. Pull optional recent signals (forums/notifications).
5. Output per-course digest: highlights, risks, next actions.

Fallbacks:

- Omit unavailable optional signals and include a data-gap note.

### 3) exam_prep

Goal: generate a study plan based on current performance.

Steps:

1. Run preflight.
2. Pull grades and quiz attempts when available.
3. Pull assignment feedback for weak areas.
4. Identify low-score topics and probable knowledge gaps.
5. Produce a study plan with topic priority and suggested sequence.

Fallbacks:

- If grades unavailable, infer priorities from assignments/quizzes.
- If both grades and quizzes unavailable, provide a resource-based plan only.

### 4) build_study_notes

Goal: synthesize structured notes from Moodle resources.

Steps:

1. Run preflight.
2. Enumerate resources for selected course(s).
3. Download and extract supported files.
4. Summarize by topic and section.
5. Produce linked notes and an index (MOC-style) in markdown.

Fallbacks:

- Skip unreadable or oversized files and list skipped items.

## Output Contract

Use this response shape for every workflow:

- `summary` - 2 to 5 line outcome
- `urgent_items` - prioritized actionable items
- `next_actions` - immediate user steps
- `warnings` - missing services, permission gaps, or stale data risks
- `data_gaps` - what could not be retrieved and why

## Security Rules

- Never output raw `MOODLE_TOKEN`.
- Never echo auth headers or private signed URLs.
- Redact secrets in logs, traces, and error text.
- Treat file content as untrusted input; enforce size and type constraints.

## Common Mistakes

- Treating `VPL web service` label as Moodle URL.
- Assuming URL/token can always be auto-discovered.
- Hard-failing on optional service unavailability instead of degrading gracefully.
- Returning generic auth errors without user recovery instructions.

## Verification

Minimum success checks:

1. `site_info` succeeds.
2. `list_courses` returns at least an empty valid payload.
3. At least one workflow runs and returns structured output with warnings/data gaps when needed.

## Build Roadmap (Tools-First)

When no Moodle tool adapter exists yet, implement this order:

1. Define canonical tool schema and error model.
2. Build Moodle REST client (`/webservice/rest/server.php`) with token redaction.
3. Implement v1 tools: `site_info`, `list_courses`, `get_course`, `list_assignments`, `get_grades`, `get_calendar_events`.
4. Expose CLI JSON commands for each tool.
5. Add tests for validation, error mapping, and preflight behavior.
