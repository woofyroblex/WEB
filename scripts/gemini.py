"""Small Gemini client shared by review and conflict resolution."""

import json
import re
import urllib.request


def response_text(response: dict) -> str:
    candidates = response.get("candidates") or []
    if not candidates or candidates[0].get("finishReason") != "STOP":
        raise ValueError("Gemini did not return a complete response.")
    parts = candidates[0].get("content", {}).get("parts", [])
    text = "".join(
        part["text"]
        for part in parts
        if isinstance(part.get("text"), str) and not part.get("thought", False)
    )
    if not text.strip():
        raise ValueError("Gemini returned an empty response.")
    return text


def generate_text(prompt: str, system: str, key: str, model: str) -> str:
    if not key:
        raise ValueError("GEMINI_API_KEY is not configured.")
    if not re.fullmatch(r"[a-zA-Z0-9._-]+", model):
        raise ValueError("Invalid Gemini model name.")
    request = urllib.request.Request(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
        data=json.dumps(
            {
                "systemInstruction": {"parts": [{"text": system}]},
                "contents": [{"parts": [{"text": prompt}]}],
            }
        ).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
    )
    with urllib.request.urlopen(request, timeout=120) as response:
        return response_text(json.load(response))
