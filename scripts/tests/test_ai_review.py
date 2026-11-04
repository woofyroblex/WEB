import unittest

from scripts.ai_review import prepare_diff
from scripts.gemini import response_text


class CompleteReviewTests(unittest.TestCase):
    def test_full_text_is_eligible_but_truncated_and_binary_diffs_are_not(self):
        for diff, expected in (
            ("x" * 45000, True),
            ("x" * 45001, False),
            ("Binary files a/image.png and b/image.png differ", False),
            ("diff --git a/link b/link\nnew file mode 120000\n", False),
        ):
            with self.subTest(expected=expected, length=len(diff)):
                text, complete = prepare_diff(diff)
                self.assertEqual(complete, expected)
                if len(diff) > 45000:
                    self.assertIn("DIFF TRUNCATED", text)
                else:
                    self.assertEqual(text, diff)

    def test_only_a_finished_text_response_is_accepted(self):
        self.assertEqual(
            response_text(
                {
                    "candidates": [
                        {
                            "finishReason": "STOP",
                            "content": {
                                "parts": [
                                    {"text": "Private reasoning", "thought": True},
                                    {"text": "Review"},
                                    {"text": " complete"},
                                ]
                            },
                        }
                    ]
                }
            ),
            "Review complete",
        )
        for response in (
            {},
            {"candidates": []},
            {
                "candidates": [
                    {
                        "finishReason": "MAX_TOKENS",
                        "content": {"parts": [{"text": "partial review"}]},
                    }
                ]
            },
            {"candidates": [{"finishReason": "STOP", "content": {"parts": []}}]},
        ):
            with self.subTest(response=response):
                with self.assertRaises(ValueError):
                    response_text(response)
