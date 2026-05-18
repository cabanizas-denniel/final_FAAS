"""Background task runner for transcription jobs.

`enqueue_transcription` schedules a job as an asyncio task. The actual
inference call runs in a worker thread (via `asyncio.to_thread`) so that the
event loop stays responsive for new uploads. A semaphore caps the number of
concurrent transcriptions to avoid exhausting CPU/memory.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

from app.models.schemas import JobStatus
from app.services.job_store import Job, JobStore
from app.services.transcriber import Transcriber

logger = logging.getLogger(__name__)


class TranscriptionWorker:
    """Coordinator that bounds concurrency for transcription jobs."""

    def __init__(
        self,
        transcriber: Transcriber,
        job_store: JobStore,
        max_concurrent: int = 2,
    ) -> None:
        self._transcriber = transcriber
        self._job_store = job_store
        self._semaphore = asyncio.Semaphore(max_concurrent)

    def enqueue(self, job: Job) -> asyncio.Task[None]:
        """Schedule a job for processing and return the asyncio.Task handle."""
        return asyncio.create_task(self._run(job), name=f"transcribe:{job.id}")

    async def _run(self, job: Job) -> None:
        async with self._semaphore:
            await self._process(job)

    async def _process(self, job: Job) -> None:
        logger.info("Job %s started (%s)", job.id, job.filename)
        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now(timezone.utc)
        await self._job_store.update(job)

        try:
            result = await asyncio.to_thread(
                self._transcriber.transcribe,
                job.audio_path,
                job.language,
                job.beam_size,
            )
            job.result = result
            job.status = JobStatus.COMPLETED
            logger.info(
                "Job %s completed (%.1fs audio, %d segments)",
                job.id,
                result.duration or 0.0,
                len(result.segments),
            )
        except Exception as exc:  # noqa: BLE001 - surface any failure to the client
            job.status = JobStatus.FAILED
            job.error = f"{type(exc).__name__}: {exc}"
            logger.exception("Job %s failed", job.id)
        finally:
            job.finished_at = datetime.now(timezone.utc)
            await self._job_store.update(job)
