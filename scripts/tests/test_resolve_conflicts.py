import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts.resolve_conflicts import resolve_file


class ConflictFileTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.original_cwd = Path.cwd()
        os.chdir(self.directory.name)
        self.addCleanup(os.chdir, self.original_cwd)
        self.addCleanup(self.directory.cleanup)

    @patch(
        "scripts.resolve_conflicts.generate_text", return_value="print('resolved')\n"
    )
    def test_valid_resolution_replaces_the_conflicted_file(self, generate):
        path = Path("example.py")
        path.write_text(
            "<<<<<<< HEAD\nprint('one')\n=======\nprint('two')\n>>>>>>> base\n"
        )
        resolve_file("example.py", "test-key", "model")
        self.assertEqual(path.read_text(), "print('resolved')\n")

    @patch("scripts.resolve_conflicts.generate_text")
    def test_lockfiles_infrastructure_and_symlinks_are_not_rewritten(self, generate):
        for filename in ("package-lock.json", "Dockerfile", "requirements.txt"):
            path = Path(filename)
            path.write_text("original")
            with self.assertRaises(ValueError):
                resolve_file(filename, "test-key", "model")
            self.assertEqual(path.read_text(), "original")
        Path("target.txt").write_text("original")
        Path("link.txt").symlink_to("target.txt")
        with self.assertRaises(ValueError):
            resolve_file("link.txt", "test-key", "model")
        self.assertEqual(Path("target.txt").read_text(), "original")
        generate.assert_not_called()

    @patch("scripts.resolve_conflicts.generate_text", return_value="modified")
    def test_parent_directory_symlink_cannot_redirect_resolution(self, generate):
        Path(".github/workflows").mkdir(parents=True)
        target = Path(".github/workflows/ci.yml")
        target.write_text("original")
        Path("alias").symlink_to(".github/workflows", target_is_directory=True)
        with self.assertRaises(ValueError):
            resolve_file("alias/ci.yml", "test-key", "model")
        self.assertEqual(target.read_text(), "original")
        generate.assert_not_called()

    @patch("scripts.resolve_conflicts.generate_text")
    def test_empty_unresolved_and_invalid_python_responses_leave_file_unchanged(
        self, generate
    ):
        for response in (
            "",
            "```python\n```",
            "<<<<<<< HEAD\nstill broken\n",
            "def broken(:\n",
        ):
            with self.subTest(response=response):
                path = Path("example.py")
                path.write_text("original")
                generate.return_value = response
                with self.assertRaises(ValueError):
                    resolve_file("example.py", "test-key", "model")
                self.assertEqual(path.read_text(), "original")
