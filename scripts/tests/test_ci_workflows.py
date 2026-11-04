"""Exercise workflow shell gates with failing and successful job outcomes."""

import json
import os
import subprocess
import tempfile
import unittest
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[2]
WORKFLOW = yaml.safe_load((ROOT / ".github/workflows/ci.yml").read_text())


class FinalGateTests(unittest.TestCase):
    def run_gate(self, **results):
        job = WORKFLOW["jobs"]["ci-ok"]
        needs = {
            name: {"result": results.get(name, "success")} for name in job["needs"]
        }
        script = job["steps"][0]["run"].replace(
            "${{ toJSON(needs) }}", json.dumps(needs)
        )
        return subprocess.run(
            ["bash", "-eo", "pipefail", "-c", script],
            capture_output=True,
            text=True,
            check=False,
        ).returncode

    def test_failed_change_detection_cannot_pass_as_skipped_checks(self):
        self.assertNotEqual(
            self.run_gate(
                changes="failure",
                frontend="skipped",
                **{
                    "backend-lint": "skipped",
                    "backend-test": "skipped",
                    "security": "skipped",
                    "docker": "skipped",
                },
            ),
            0,
        )

    def test_workflow_validation_failure_blocks_the_gate(self):
        self.assertNotEqual(self.run_gate(**{"workflow-checks": "failure"}), 0)

    def test_successful_change_detection_allows_unchanged_components(self):
        self.assertEqual(self.run_gate(frontend="skipped", docker="skipped"), 0)

    def test_failed_or_cancelled_jobs_block_the_gate(self):
        for result in ("failure", "cancelled"):
            with self.subTest(result=result):
                self.assertNotEqual(self.run_gate(frontend=result), 0)

    def test_all_successful_jobs_pass(self):
        self.assertEqual(self.run_gate(), 0)


class RequiredComponentTests(unittest.TestCase):
    def run_detection(self, missing=None):
        steps = WORKFLOW["jobs"]["changes"]["steps"]
        script = next(step["run"] for step in steps if step.get("id") == "components")
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for filename in (
                "frontend/package.json",
                "frontend/package-lock.json",
                "backend/requirements.txt",
                "backend/pyproject.toml",
                "frontend/Dockerfile",
                "backend/Dockerfile",
                "docker-compose.yml",
                "frontend/src/App.tsx",
                "backend/manage.py",
            ):
                if filename == missing:
                    continue
                path = root / filename
                path.parent.mkdir(parents=True, exist_ok=True)
                path.touch()
            subprocess.run(["git", "init", "-q", directory], check=True)
            subprocess.run(["git", "add", "."], cwd=root, check=True)
            output = root / "outputs"
            process = subprocess.run(
                ["bash", "-eo", "pipefail", "-c", script],
                cwd=root,
                env={**os.environ, "GITHUB_OUTPUT": str(output)},
                capture_output=True,
                text=True,
                check=False,
            )
            return process.returncode, output.read_text() if output.exists() else ""

    def test_missing_required_files_fail_instead_of_disabling_validation(self):
        for filename in (
            "frontend/package.json",
            "frontend/package-lock.json",
            "backend/requirements.txt",
            "frontend/Dockerfile",
            "backend/Dockerfile",
        ):
            with self.subTest(filename=filename):
                code, _ = self.run_detection(filename)
                self.assertNotEqual(code, 0)

    def test_complete_project_enables_all_components(self):
        code, output = self.run_detection()
        self.assertEqual(code, 0)
        self.assertIn("frontend=true", output.splitlines())
        self.assertIn("backend=true", output.splitlines())
        self.assertIn("docker=true", output.splitlines())


if __name__ == "__main__":
    unittest.main()
