"""Thread-safe, in-memory job registry.

Replace with Redis / a database for multi-replica deployments. This minimal
implementation is sufficient for a local single-process FaaS.
"""

from __future__ import annotations

import asyncio
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from app.models.schemas import JobInfo, JobStatus, TranscriptionProfile, TranscriptionResult


@dataclass
class Job:
    """Internal job record."""

    id: str
    filename: str
    audio_path: Path
    status: JobStatus = JobStatus.QUEUED
    created_at: datetime = field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    error: Optional[str] = None
    result: Optional[TranscriptionResult] = None
    language: Optional[str] = None
    profile: TranscriptionProfile = TranscriptionProfile.PRECISE
    beam_size: int = 5
    include_timestamps: bool = False

    def to_info(self) -> JobInfo:
        return JobInfo(
            job_id=self.id,
            status=self.status,
            filename=self.filename,
            created_at=self.created_at,
            started_at=self.started_at,
            finished_at=self.finished_at,
            error=self.error,
            profile=self.profile,
            include_timestamps=self.include_timestamps,
            result=self.result,
        )


class JobStore:
    """Async-safe job registry with optional TTL-based pruning."""

    def __init__(self, retention_seconds: int = 3600) -> None:
        self._jobs: dict[str, Job] = {}
        self._lock = asyncio.Lock()
        self._retention_seconds = retention_seconds

    async def create(
        self,
        filename: str,
        audio_path: Path,
        language: Optional[str] = None,
        profile: TranscriptionProfile = TranscriptionProfile.PRECISE,
        beam_size: int = 5,
        include_timestamps: bool = False,
    ) -> Job:
        job = Job(
            id=uuid.uuid4().hex,
            filename=filename,
            audio_path=audio_path,
            language=language,
            profile=profile,
            beam_size=beam_size,
            include_timestamps=include_timestamps,
        )
        async with self._lock:
            self._jobs[job.id] = job
        return job

    async def get(self, job_id: str) -> Optional[Job]:
        async with self._lock:
            return self._jobs.get(job_id)

    async def list_all(self, limit: int = 100) -> list[Job]:
        async with self._lock:
            jobs = sorted(
                self._jobs.values(),
                key=lambda j: j.created_at,
                reverse=True,
            )
        return jobs[:limit]

    async def update(self, job: Job) -> None:
        async with self._lock:
            self._jobs[job.id] = job

    async def delete(self, job_id: str) -> bool:
        async with self._lock:
            job = self._jobs.pop(job_id, None)
        if job and job.audio_path.exists():
            try:
                job.audio_path.unlink()
            except OSError:
                pass
        return job is not None

    async def prune_expired(self) -> int:
        """Remove finished jobs older than `retention_seconds`. Returns count."""
        cutoff = time.time() - self._retention_seconds
        removed = 0
        async with self._lock:
            for jid in list(self._jobs.keys()):
                job = self._jobs[jid]
                if job.finished_at and job.finished_at.timestamp() < cutoff:
                    del self._jobs[jid]
                    removed += 1
                    if job.audio_path.exists():
                        try:
                            job.audio_path.unlink()
                        except OSError:
                            pass
        return removed
