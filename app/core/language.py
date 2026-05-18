"""Language code normalization for Whisper / faster-whisper."""

from __future__ import annotations

from typing import Optional

# ISO codes we expose in the UI that differ from Whisper's expected codes.
_UI_TO_WHISPER: dict[str, str] = {
    "fil": "tl",  # Filipino → Tagalog (Whisper code)
}


def normalize_language(language: Optional[str]) -> Optional[str]:
    """Return a Whisper language code, or None for auto-detect.

    Treats blank strings and whitespace as auto-detect. Maps UI aliases
    (e.g. ``fil`` → ``tl``).
    """
    if language is None:
        return None
    cleaned = language.strip().lower()
    if not cleaned:
        return None
    return _UI_TO_WHISPER.get(cleaned, cleaned)
