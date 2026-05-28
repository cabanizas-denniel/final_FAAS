"""
FaaS orchestrator — provisions one ephemeral Docker container per transcription.

FaaS lifecycle per job
----------------------
3. DORMANT   – function code sits idle in the image; no compute used.
4. TRIGGERED – HTTP upload received; job created in the store.
5. PROVISION – orchestrator calls docker.containers.run() → new container starts.
6. RUN       – container executes app.fn.transcribe, writes result JSON, exits.
7. SCALE     – semaphore allows MAX_CONCURRENT_JOBS parallel containers.
8. RESULT    – orchestrator reads the result file and updates the job record.
9. HIBERNATE – container is auto-removed (remove=True); compute freed.
"""
from __future__ import annotations

import asyncio
import logging
import os
import socket
from datetime import datetime, timezone
from pathlib import Path

from app.models.schemas import JobStatus, TranscriptionResult
from app.services.job_store import Job, JobStore

logger = logging.getLogger(__name__)

_IMAGE = os.environ.get("WORKER_IMAGE", "audio-transcription-faas:latest")


def _docker_client():
    try:
        import docker
        return docker.from_env()
    except Exception:
        return None


class TranscriptionWorker:
    """FaaS platform — bounds concurrency and dispatches work to containers."""

    def __init__(self, job_store: JobStore, max_concurrent: int = 2, **_) -> None:
        self._job_store = job_store
        self._sem = asyncio.Semaphore(max_concurrent)

    def enqueue(self, job: Job) -> asyncio.Task[None]:
        return asyncio.create_task(self._run(job), name=f"fn:{job.id}")

    async def _run(self, job: Job) -> None:
        async with self._sem:
            await self._process(job)

    async def _process(self, job: Job) -> None:
        job.status = JobStatus.PROCESSING
        job.started_at = datetime.now(timezone.utc)
        await self._job_store.update(job)

        result_path = job.audio_path.parent / "jobs" / f"{job.id}_result.json"
        result_path.parent.mkdir(parents=True, exist_ok=True)

        try:
            await asyncio.to_thread(self._invoke_fn, job, result_path)
            job.result = TranscriptionResult.model_validate_json(
                result_path.read_text(encoding="utf-8")
            )
            job.status = JobStatus.COMPLETED
            logger.info("Job %s completed", job.id)
            # FaaS: discard the input audio now that the function has returned its result
            job.audio_path.unlink(missing_ok=True)
        except Exception as exc:
            job.status = JobStatus.FAILED
            job.error = f"{type(exc).__name__}: {exc}"
            logger.exception("Job %s failed", job.id)
        finally:
            result_path.unlink(missing_ok=True)
            job.finished_at = datetime.now(timezone.utc)
            await self._job_store.update(job)

    # ------------------------------------------------------------------
    # Step 5 + 9: Provision → Run → Hibernate
    # ------------------------------------------------------------------

    def _invoke_fn(self, job: Job, result_path: Path) -> None:
        client = _docker_client()
        if client is None:
            logger.warning("Docker socket unavailable — running in-process (fallback)")
            _run_inprocess(job, result_path)
            return

        env = {
            "AUDIO_PATH":  str(job.audio_path),
            "RESULT_PATH": str(result_path),
            "LANGUAGE":    job.language or "",
            "BEAM_SIZE":   str(job.beam_size),
            **{k: os.environ[k]
               for k in ("WHISPER_MODEL", "WHISPER_COMPUTE_TYPE", "WHISPER_DEVICE")
               if k in os.environ},
        }

        logger.info("Provisioning container fn-%s for job %s", job.id[:12], job.id)
        try:
            client.containers.run(
                _IMAGE,
                command=["python", "-m", "app.fn.transcribe"],
                environment=env,
                # Inherit uploads + model-cache volumes from the orchestrator container
                volumes_from=[socket.gethostname()],
                remove=True,   # Step 9: auto-remove on exit → Hibernate
                name=f"fn-{job.id[:12]}",
            )
        finally:
            client.close()
        logger.info("Container fn-%s terminated (hibernated)", job.id[:12])


def _run_inprocess(job: Job, result_path: Path) -> None:
    """In-process fallback when Docker socket is not accessible (local dev)."""
    from app.core.config import get_settings
    from app.services.transcriber import Transcriber

    result = Transcriber(get_settings()).transcribe(
        job.audio_path, language=job.language, beam_size=job.beam_size
    )
    result_path.write_text(result.model_dump_json(), encoding="utf-8")
