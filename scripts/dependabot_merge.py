"""Merge a known non-major Dependabot revision only after its CI succeeds."""

import os
import subprocess

from scripts.automation import dependabot_update_allowed, gh_json, merge_when_ci_passes


def main():
    if not dependabot_update_allowed(os.environ.get("UPDATE_TYPE", "")):
        print("Unknown or major update: manual review required.")
        return
    repository = os.environ["GITHUB_REPOSITORY"]
    number = os.environ["PR_NUMBER"]
    author = gh_json("pr", "view", number, "--repo", repository, "--json", "author")
    if author.get("author", {}).get("login") != "app/dependabot":
        # GitHub CLI may expose the GraphQL actor with its REST login.
        if author.get("author", {}).get("login") != "dependabot[bot]":
            raise ValueError("Only Dependabot-authored pull requests are eligible.")
    subprocess.run(
        [
            "gh",
            "pr",
            "review",
            number,
            "--repo",
            repository,
            "--approve",
            "--body",
            "Approved non-major dependency update; merging still requires successful CI.",
        ],
        check=True,
    )
    merge_when_ci_passes(repository, number, os.environ["HEAD_SHA"])


if __name__ == "__main__":
    main()
