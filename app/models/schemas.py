"""Pydantic models for API requests and responses."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    """Lifecycle states of a transcription job."""

    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class TranscriptSegment(BaseModel):
    """A single timed segment of a transcript."""

    start: float = Field(..., description="Segment start time in seconds.")
    end: float = Field(..., description="Segment end time in seconds.")
    text: str = Field(..., description="Transcribed text for this segment.")


class TranscriptionResult(BaseModel):
    """Final transcription payload."""

    language: Optional[str] = Field(default=None, description="Detected language code.")
    language_probability: Optional[float] = Field(default=None)
    duration: Optional[float] = Field(default=None, description="Audio duration (s).")
    text: str = Field(..., description="Full concatenated transcript text.")
    segments: list[TranscriptSegment] = Field(default_factory=list)


class JobCreated(BaseModel):
    """Response returned immediately after a successful upload."""

    job_id: str
    status: JobStatus
    filename: str
    created_at: datetime
    poll_url: str
    result_url: str


class TranscriptionProfile(str, Enum):
    """Speed vs accuracy presets (maps to Whisper beam search width)."""

    QUICK = "quick"
    STANDARD = "standard"
    PRECISE = "precise"


PROFILE_BEAM_SIZES: dict[TranscriptionProfile, int] = {
    TranscriptionProfile.QUICK: 1,
    TranscriptionProfile.STANDARD: 3,
    TranscriptionProfile.PRECISE: 5,
}


class JobInfo(BaseModel):
    """Status snapshot of an existing job."""

    job_id: str
    status: JobStatus
    filename: str
    created_at: datetime
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
    profile: TranscriptionProfile = TranscriptionProfile.PRECISE
    include_timestamps: bool = Field(
        default=False,
        description="When true, UI and TXT export show segment time ranges.",
    )
    result: Optional[TranscriptionResult] = None


class JobListResponse(BaseModel):
    """Paginated-style list of jobs (newest first)."""

    jobs: list[JobInfo]
    total: int


class HealthResponse(BaseModel):
    """Simple liveness/readiness payload."""

    status: str
    app: str
    version: str
    model: str
    device: str
    docker_available: bool
