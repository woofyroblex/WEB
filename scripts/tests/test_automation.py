"""Safety regressions for bot decisions and their GitHub command boundary."""

import json
import subprocess
import unittest
from unittest.mock import patch

from scripts.automation import (
    ci_state,
    dependabot_update_allowed,
    merge_when_ci_passes,
    resolver_request_allowed,
    review_allows_merge,
    validate_pr,
)


def review(**overrides):
    verdict = {
        "risk_level": "LOW",
        "safe_to_auto_merge": True,
        "confidence": 9,
        "reason": "No actionable findings.",
        **overrides,
    }
    return "Reviewed the complete change.\n```json\n" + json.dumps(verdict) + "\n```"


def pull_request(**overrides):
    return {
        "state": "OPEN",
        "headRefOid": "a" * 40,
        "baseRefOid": "b" * 40,
        "headRefName": "feature",
        "baseRefName": "main",
        "isCrossRepository": False,
        "headRepository": {"nameWithOwner": "owner/repo"},
        **overrides,
    }


class ReviewPolicyTests(unittest.TestCase):
    def allowed(self, text, **kwargs):
        return review_allows_merge(
            text,
            diff_complete=kwargs.get("diff_complete", True),
            changed_files=kwargs.get("changed_files", ["frontend/src/App.tsx"]),
        )

    def test_complete_low_risk_review_can_merge(self):
        self.assertTrue(self.allowed(review()))

    def test_non_boolean_merge_verdicts_cannot_authorize_a_merge(self):
        for value in ("false", "true", 1, None, [], {}):
            with self.subTest(value=value):
                self.assertFalse(self.allowed(review(safe_to_auto_merge=value)))

    def test_high_risk_or_uncertain_verdicts_are_rejected(self):
        for verdict in (
            {"risk_level": "HIGH"},
            {"risk_level": "MEDIUM"},
            {"risk_level": "low"},
            {"safe_to_auto_merge": False},
            {"confidence": 7},
            {"confidence": True},
            {"confidence": 11},
            {"reason": ""},
        ):
            with self.subTest(verdict=verdict):
                self.assertFalse(self.allowed(review(**verdict)))

    def test_truncated_or_excluded_diff_cannot_authorize_a_merge(self):
        self.assertFalse(self.allowed(review(), diff_complete=False))

    def test_malformed_or_ambiguous_replies_cannot_authorize_a_merge(self):
        for text in (
            "Looks good",
            "```json\nnot json\n```",
            "```json\n[]\n```",
            review() + "\n" + review(risk_level="HIGH"),
            review() + "\nActually there is a security issue.",
            '```json\n{"risk_level":"HIGH","risk_level":"LOW","safe_to_auto_merge":true,"confidence":9,"reason":"ok"}\n```',
        ):
            with self.subTest(text=text):
                self.assertFalse(self.allowed(text))

    def test_infrastructure_changes_need_manual_review(self):
        for path in (
            ".github/workflows/ci.yml",
            "scripts/automation.py",
            "backend/projects/migrations/0003_change.py",
            "backend/Dockerfile",
            "docker-compose.yml",
            "frontend/package-lock.json",
            "frontend/package.json",
            "backend/requirements.txt",
        ):
            with self.subTest(path=path):
                self.assertFalse(self.allowed(review(), changed_files=[path]))


class ResolverPolicyTests(unittest.TestCase):
    def test_only_explicit_authorized_command_starts_resolution(self):
        for body, association, expected in (
            ("@ai-bot resolve conflicts", "OWNER", True),
            ("  @ai-bot resolve conflicts\n", "COLLABORATOR", True),
            ("@ai-bot resolve conflicts", "NONE", False),
            ("@ai-bot thanks", "OWNER", False),
            ("Please do not run @ai-bot resolve conflicts", "OWNER", False),
        ):
            with self.subTest(body=body, association=association):
                self.assertEqual(resolver_request_allowed(body, association), expected)

    def test_fork_closed_and_changed_head_prs_are_rejected(self):
        for metadata in (
            pull_request(isCrossRepository=True),
            pull_request(headRepository={"nameWithOwner": "fork/repo"}),
            pull_request(state="CLOSED"),
            pull_request(headRefOid="c" * 40),
        ):
            with self.subTest(metadata=metadata):
                with self.assertRaises(ValueError):
                    validate_pr(metadata, "owner/repo", expected_head="a" * 40)

    def test_same_repository_open_pr_with_expected_head_is_valid(self):
        validate_pr(pull_request(), "owner/repo", expected_head="a" * 40)


class MergeGateTests(unittest.TestCase):
    def test_only_successful_ci_counts_as_ready(self):
        for state, expected in (
            ("SUCCESS", "success"),
            ("PENDING", "pending"),
            ("FAILURE", "failure"),
            ("CANCELLED", "failure"),
            ("SKIPPED", "failure"),
        ):
            with self.subTest(state=state):
                self.assertEqual(
                    ci_state([{"name": "CI passed", "workflow": "CI", "state": state}]),
                    expected,
                )
        self.assertEqual(ci_state([]), "pending")
        self.assertEqual(
            ci_state([{"name": "CI passed", "workflow": "Other", "state": "SUCCESS"}]),
            "pending",
        )
        self.assertEqual(
            ci_state(
                [
                    {"name": "CI passed", "workflow": "CI", "state": "SUCCESS"},
                    {"name": "CI passed", "workflow": "CI", "state": "PENDING"},
                ]
            ),
            "pending",
        )

    @patch("scripts.automation.gh_json")
    @patch("scripts.automation.subprocess.run")
    def test_failed_ci_does_not_issue_a_merge(self, run, gh_json):
        gh_json.side_effect = [
            pull_request(),
            [{"name": "CI passed", "workflow": "CI", "state": "FAILURE"}],
        ]
        with self.assertRaises(RuntimeError):
            merge_when_ci_passes("owner/repo", "17", "a" * 40)
        run.assert_not_called()

    @patch("scripts.automation.gh_json")
    @patch("scripts.automation.subprocess.run")
    def test_successful_ci_merges_only_the_reviewed_head(self, run, gh_json):
        gh_json.side_effect = [
            pull_request(),
            [{"name": "CI passed", "workflow": "CI", "state": "SUCCESS"}],
            pull_request(),
        ]
        run.return_value = subprocess.CompletedProcess([], 0)
        merge_when_ci_passes("owner/repo", "17", "a" * 40)
        run.assert_called_once_with(
            [
                "gh",
                "pr",
                "merge",
                "17",
                "--repo",
                "owner/repo",
                "--squash",
                "--match-head-commit",
                "a" * 40,
            ],
            check=True,
        )

    @patch("scripts.automation.gh_json")
    @patch("scripts.automation.subprocess.run")
    def test_head_changed_during_wait_is_never_merged(self, run, gh_json):
        gh_json.side_effect = [
            pull_request(),
            [{"name": "CI passed", "workflow": "CI", "state": "SUCCESS"}],
            pull_request(headRefOid="c" * 40),
        ]
        with self.assertRaises(ValueError):
            merge_when_ci_passes("owner/repo", "17", "a" * 40)
        run.assert_not_called()

    def test_only_known_non_major_dependabot_updates_are_eligible(self):
        for update_type, expected in (
            ("version-update:semver-patch", True),
            ("version-update:semver-minor", True),
            ("version-update:semver-major", False),
            ("", False),
            ("unknown", False),
        ):
            self.assertEqual(dependabot_update_allowed(update_type), expected)


if __name__ == "__main__":
    unittest.main()
