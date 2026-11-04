# CI and merge automation hardening

The user authorized fixing the CI review findings, checking for further issues,
and pushing the verified changes to `dev`.

## Intent

Make the existing GitHub Actions checks reliable: a successful required check
must represent successful validation, and automation must not merge untested or
incompletely reviewed code. Keep the existing React/Django application and bots.

## Approach

Repair the existing workflows, extract security-sensitive bot decisions into
testable Python functions, and add frontend behavior tests with Vitest. Replacing
the CI platform or removing the bots would change functionality unnecessarily.
These implementation choices are the agent's decisions under the approved fixes.

## Requirements

- Change detection failure or missing required project files fails the final gate.
- Required checks enforce formatting, typing, tests, and security findings.
- AI merging requires a complete diff and a strictly valid low-risk verdict.
- Merge actions are tied to the reviewed head commit and protected by required CI.
- Ordinary PR comments cannot interrupt an AI review or start conflict resolution.
- Conflict resolution resolves repository identity before checkout, rejects forks
  and stale heads, and does not publish unchecked lockfile resolutions.
- Frontend tests exercise authentication, authorization-dependent UI, and errors.
- Preserve existing branch rules while adding the `CI passed` requirement.
- Use fresh local verification, an independent review, and remote checks; push
  without force to `dev`, preserving any concurrent work.

## Constraints and verification

Use Node 22 and Python 3.12 as in CI. No secrets belong in source or logs.
The baseline is clean `dev` at `f5dde4f`. Existing local backend tests need
WeasyPrint native libraries. Check the same backend suite with PostgreSQL and
native PDF rendering before completion. Do not claim a queued CI run succeeded.
