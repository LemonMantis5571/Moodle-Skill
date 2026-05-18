# Moodle Skill

Portable, agent-agnostic Moodle skill specification for assistants that can call Moodle capabilities through MCP or equivalent adapters.

This repository is intentionally implementation-neutral: it defines behavior, workflows, and guardrails rather than binding to one specific tool server.

## What This Provides

- A root-level `SKILL.md` with deterministic Moodle workflows.
- Mandatory credential onboarding prompts for users.
- Graceful degradation strategy when optional Moodle services are disabled.
- Security and output contracts for production-safe behavior.

## Required Inputs

- `MOODLE_URL` - Base Moodle URL, for example `https://campus.school.edu`
- `MOODLE_TOKEN` - Token from `Moodle mobile web service`

Recommended optional inputs:

- `TIMEZONE`
- `LOOKAHEAD_DAYS`

## Quickstart

1. Configure your agent runtime with `MOODLE_URL` and `MOODLE_TOKEN`.
2. Load `SKILL.md` in your runtime's skill/instruction mechanism.
3. Run preflight checks:
   - `site_info`
   - `list_courses`
4. Execute workflows:
   - `whats_due`
   - `course_digest`
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

- Invalid token: regenerate token and retry preflight.
- Token works but missing grades/quizzes/forums: admin likely has those services disabled.
- VPL token limited scope: request token for `Moodle mobile web service`.
- Missing credentials: agent must trigger credential collection prompt before any workflow.

## Files

- `SKILL.md` - Main skill definition.
- `capability-matrix.md` - Capability requirements and fallback behavior.
