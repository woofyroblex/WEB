# CI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Fix the reviewed CI and bot defects, verify the complete result, and push to `dev`.

**Architecture:** Retain the workflows and make their gates fail closed. Move bot policy into testable Python, add real React behavior tests, and require the aggregate CI check on protected branches.

**Tech Stack:** GitHub Actions, Python 3.12, Django, TypeScript, React, Vitest, PostgreSQL, Docker.

**Spec:** `docs/superpowers/specs/2026-11-04-ci-hardening-design.md`

## Global Constraints

- Preserve existing application and bot functionality; no forced pushes.
- Use Node 22 and Python 3.12 as in CI.
- No secrets in source or logs.
- Recheck remote `dev` before publishing.

## Review Focus

- Missing files and failed prerequisites cannot become successful skipped checks.
- Malformed/contradictory AI replies and omitted diff content cannot authorize merging.
- Comments, fork PRs, and changed heads cannot redirect or interrupt privileged bot work.
- Failed checks and token permissions cannot bypass required CI or leave it permanently pending.
- Frontend authentication failures and role-dependent UI remain covered by real behavior tests.

## Task 1: Enforce CI checks

**Files:** `.github/workflows/ci.yml`, `scripts/tests/test_ci_workflows.py`, `backend/pyproject.toml`, backend typing fixes, frontend scripts/formatting.

**Interfaces:** Workflow tests execute the actual gate and component-detection shell with controlled inputs. `CI passed` remains the required status name.

- [ ] Add regression tests for failed change detection, failed/cancelled jobs, valid selective skips, and missing manifests; run and observe failures.
- [ ] Fix dependencies, permissions, component validation, and failure handling. Make lint/format/type/security steps blocking; remove ambiguous test-runner fallbacks.
- [ ] Configure Django-aware Mypy and correct remaining typing errors without changing behavior.
- [ ] Run workflow tests, Ruff, Mypy, formatting, and application checks; investigate newly exposed failures.
- [ ] Commit the verified CI changes.

## Task 2: Harden AI and dependency automation

**Files:** `.github/workflows/ai-review.yml`, `.github/workflows/dependabot-automerge.yml`, `scripts/ai_review.py`, `scripts/tests/test_ai_review.py`.

**Interfaces:** Pure review policy accepts review text, diff completeness, and changed paths; merge commands use the reviewed head SHA. PR metadata is fetched with explicit repository identity.

- [ ] Add failing tests for string booleans, high-risk verdicts, malformed JSON, truncated/excluded changes, sensitive paths, wrong comments, forks, and stale heads.
- [ ] Extract policy and review orchestration, validate verdicts strictly, and separate review/comment concurrency.
- [ ] Repair resolver repository selection, explicit command gating, fork/stale-head checks, and lockfile handling; preserve safe conflict resolution.
- [ ] Require successful CI for the exact reviewed head before merge; inspect bot permission and trigger behavior.
- [ ] Run policy and workflow tests, syntax/lint checks, and commit.

## Task 3: Add frontend behavior tests

**Files:** `frontend/package.json`, lockfile, Vitest configuration, `frontend/src/**/*.test.tsx` and test setup.

**Interfaces:** `npm test` runs once and fails on failures or no tests; `npm run test:coverage` produces coverage in `frontend/coverage`.

- [ ] Write behavior tests for sign-in failure, session recovery, user/admin access, and project operations; demonstrate the missing test command fails.
- [ ] Install/configure Vitest and Testing Library with versions compatible with the existing Vite/React versions.
- [ ] Run all frontend tests, coverage, lint, formatting, and production build; fix any exposed bugs with regressions.
- [ ] Commit.

## Task 4: Verify, enforce repository gates, and publish

**Files:** Existing GitHub branch rules, README CI instructions, final reviewed diff.

**Interfaces:** Preserve rules while requiring `CI passed`; publish the tested commit to `refs/heads/dev` without force.

- [ ] Run full CI-equivalent checks including PostgreSQL backend tests, PDF rendering, Docker builds, and security scans where available.
- [ ] Request an independent whole-change code review; fix important findings with reproducing tests.
- [ ] Update repository rules to require `CI passed`, read them back, and document local commands.
- [ ] Recheck remote branch, commit any final fixes, push to `dev`, and inspect the resulting CI run.
- [ ] Confirm each original finding and review focus is resolved; report commit and verified checks.
