"""Whisper-based transcription engine.

Uses `faster-whisper` (CTranslate2 backend) because it runs efficiently on
CPU with int8 quantization, making it ideal for a lightweight local FaaS.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from app.core.config import Settings
from app.core.language import normalize_language
from app.models.schemas import TranscriptionResult, TranscriptSegment

logger = logging.getLogger(__name__)


class Transcriber:
    """Lazy wrapper around a `faster_whisper.WhisperModel`.

    The model is loaded once on first use (or via `load()` from the lifespan
    handler) and reused across requests. The underlying inference call is
    synchronous and CPU-bound, so callers should invoke `transcribe()` from a
    worker thread (e.g. `asyncio.to_thread`).
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._model = None  # type: ignore[assignment]

    @property
    def is_loaded(self) -> bool:
        return self._model is not None

    def load(self) -> None:
        """Load the Whisper model into memory."""
        if self._model is not None:
            return

        from faster_whisper import WhisperModel

        s = self._settings
        logger.info(
            "Loading Whisper model '%s' on device=%s compute_type=%s",
            s.whisper_model,
            s.whisper_device,
            s.whisper_compute_type,
        )
        self._model = WhisperModel(
            s.whisper_model,
            device=s.whisper_device,
            compute_type=s.whisper_compute_type,
        )
        logger.info("Whisper model loaded.")

    def transcribe(
        self,
        audio_path: Path,
        language: Optional[str] = None,
        beam_size: Optional[int] = None,
    ) -> TranscriptionResult:
        """Run synchronous transcription on the given audio file."""
        if self._model is None:
            self.load()
        assert self._model is not None

        s = self._settings
        lang = normalize_language(language) or normalize_language(s.whisper_language)

        segments_iter, info = self._model.transcribe(
            str(audio_path),
            language=lang,  # None → auto-detect
            beam_size=beam_size if beam_size is not None else s.whisper_beam_size,
            vad_filter=True,
        )

        segments: list[TranscriptSegment] = []
        text_parts: list[str] = []
        for seg in segments_iter:
            segments.append(
                TranscriptSegment(start=seg.start, end=seg.end, text=seg.text.strip())
            )
            text_parts.append(seg.text)

        return TranscriptionResult(
            language=info.language,
            language_probability=getattr(info, "language_probability", None),
            duration=getattr(info, "duration", None),
            text="".join(text_parts).strip(),
            segments=segments,
        )
