"""Application configuration loaded from environment variables / .env file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.language import normalize_language
from app.core.media import ALLOWED_AUDIO_EXTENSIONS


class Settings(BaseSettings):
    """Centralized application settings.

    All values can be overridden via environment variables or a `.env` file
    sitting next to the project root.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # --- API ---------------------------------------------------------------
    app_name: str = Field(default="Audio Transcription FaaS")
    api_host: str = Field(default="0.0.0.0")
    api_port: int = Field(default=8000)
    log_level: str = Field(default="INFO")

    # --- Uploads -----------------------------------------------------------
    upload_dir: Path = Field(default=Path("uploads"))
    max_upload_mb: int = Field(default=200)
    allowed_extensions: tuple[str, ...] = Field(default=ALLOWED_AUDIO_EXTENSIONS)

    # --- Whisper / faster-whisper -----------------------------------------
    # Model sizes: tiny, base, small, medium, large-v3
    whisper_model: str = Field(default="tiny")
    whisper_device: Literal["cpu", "cuda", "auto"] = Field(default="cpu")
    # int8 is the lightest CPU option; use float16 on GPU.
    whisper_compute_type: str = Field(default="int8")
    whisper_language: str | None = Field(default=None)  # None -> auto-detect
    whisper_beam_size: int = Field(default=1)

    # --- Concurrency -------------------------------------------------------
    max_concurrent_jobs: int = Field(default=2)
    job_retention_seconds: int = Field(default=3600)

    @field_validator("whisper_language", mode="before")
    @classmethod
    def _coerce_whisper_language(cls, value: object) -> str | None:
        if value is None:
            return None
        return normalize_language(str(value))


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return a cached Settings instance (env vars are read once per process)."""
    return Settings()
