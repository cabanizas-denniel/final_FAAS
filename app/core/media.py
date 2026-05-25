"""Shared media constraints (keep in sync with static/js/config.js)."""

from __future__ import annotations

# Decoded by ffmpeg inside faster-whisper; validated by file extension on upload.
ALLOWED_AUDIO_EXTENSIONS: tuple[str, ...] = (
    "wav",
    "mp3",
    "m4a",
    "flac",
    "ogg",
    "webm",
    "mp4",
    "mov",
    "aac",
    "mpeg",
    "mpg",
    "wma",
    "wmv",
)
