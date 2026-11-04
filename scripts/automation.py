"""Shared, fail-closed policies for GitHub review and merge automation."""

import json
import re
import subprocess
import time
from pathlib import PurePosixPath

PR_FIELDS = (
    "state,headRefOid,baseRefOid,headRefName,baseRefName,"
    "isCrossRepository,headRepository"
)


def sensitive_path(filename: str) -> bool:
    path = PurePosixPath(filename)
    return (
        filename.startswith((".github/", "scripts/"))
        or "migrations" in path.parts
        or path.name.startswith(("Dockerfile", "docker-compose", "requirements"))
        or path.name
        in {
            ".dockerignore",
            ".gitattributes",
            ".gitmodules",
            ".gitignore",
            "package.json",
            "package-lock.json",
            "yarn.lock",
            "pnpm-lock.yaml",
            "pyproject.toml",
            "uv.lock",
            "Pipfile",
            "Pipfile.lock",
        }
    )


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate JSON field: {key}")
        result[key] = value
    return result


def review_allows_merge(
    review_text: str, *, diff_complete: bool, changed_files: list[str]
) -> bool:
    if (
        not diff_complete
        or not changed_files
        or any(map(sensitive_path, changed_files))
    ):
        return False
    matches = list(re.finditer(r"```json\s*(.*?)\s*```", review_text, re.DOTALL))
    if len(matches) != 1 or review_text[matches[0].end() :].strip():
        return False
    try:
        verdict = json.loads(matches[0].group(1), object_pairs_hook=unique_object)
    except (ValueError, TypeError):
        return False
    return (
        isinstance(verdict, dict)
        and verdict.get("safe_to_auto_merge") is True
        and verdict.get("risk_level") == "LOW"
        and type(verdict.get("confidence")) is int
        and 8 <= verdict["confidence"] <= 10
        and isinstance(verdict.get("reason"), str)
        and bool(verdict["reason"].strip())
    )


def resolver_request_allowed(body: str, association: str) -> bool:
    return body.strip() == "@ai-bot resolve conflicts" and association in {
        "OWNER",
        "MEMBER",
        "COLLABORATOR",
    }


def validate_pr(metadata: dict, repository: str, expected_head: str | None = None):
    if metadata.get("state") != "OPEN":
        raise ValueError("The pull request is no longer open.")
    if (
        metadata.get("isCrossRepository") is not False
        or (metadata.get("headRepository") or {}).get("nameWithOwner") != repository
    ):
        raise ValueError("Automation only supports branches in this repository.")
    for key in ("headRefOid", "baseRefOid"):
        if not re.fullmatch(r"[0-9a-f]{40}", metadata.get(key, "")):
            raise ValueError(f"Missing or invalid {key}.")
    if expected_head is not None and metadata["headRefOid"] != expected_head:
        raise ValueError("PR head changed; a fresh review and CI run are required.")


def dependabot_update_allowed(update_type: str) -> bool:
    return update_type in {"version-update:semver-patch", "version-update:semver-minor"}


def gh_json(*arguments: str, allowed_codes=(0,)):
    result = subprocess.run(
        ["gh", *arguments], capture_output=True, text=True, check=False
    )
    if result.returncode not in allowed_codes:
        raise RuntimeError(f"GitHub command failed: {result.stderr.strip()}")
    return json.loads(result.stdout)


def get_pr(repository: str, number: str):
    return gh_json("pr", "view", number, "--repo", repository, "--json", PR_FIELDS)


def ci_state(checks: list[dict]) -> str:
    matching = [
        check
        for check in checks
        if check.get("name") == "CI passed" and check.get("workflow") == "CI"
    ]
    pending = {"PENDING", "QUEUED", "IN_PROGRESS", "WAITING", "REQUESTED", "EXPECTED"}
    if any(check.get("state") not in pending | {"SUCCESS"} for check in matching):
        return "failure"
    if matching and all(check.get("state") == "SUCCESS" for check in matching):
        return "success"
    return "pending"


def merge_when_ci_passes(
    repository: str, number: str, head_sha: str, *, timeout: int = 1800
):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        validate_pr(get_pr(repository, number), repository, expected_head=head_sha)
        checks = gh_json(
            "pr",
            "checks",
            number,
            "--repo",
            repository,
            "--json",
            "name,state,workflow",
            allowed_codes=(0, 1, 8),
        )
        state = ci_state(checks)
        if state == "failure":
            raise RuntimeError("CI passed did not succeed; automatic merge refused.")
        if state == "success":
            validate_pr(get_pr(repository, number), repository, expected_head=head_sha)
            subprocess.run(
                [
                    "gh",
                    "pr",
                    "merge",
                    number,
                    "--repo",
                    repository,
                    "--squash",
                    "--match-head-commit",
                    head_sha,
                ],
                check=True,
            )
            return
        time.sleep(15)
    raise RuntimeError("Timed out waiting for CI; pull request was not merged.")
