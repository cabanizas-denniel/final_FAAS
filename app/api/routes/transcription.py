"""Transcription REST endpoints."""

from __future__ import annotations

import logging
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
    status,
)

from app.api.dependencies import get_job_store, get_settings_dep, get_worker
from app.core.language import normalize_language
from app.core.config import Settings
from app.models.schemas import (
    PROFILE_BEAM_SIZES,
    JobCreated,
    JobInfo,
    JobListResponse,
    JobStatus,
    TranscriptionProfile,
    TranscriptionResult,
)
from app.services.job_store import Job, JobStore
from app.workers.tasks import TranscriptionWorker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/transcriptions", tags=["transcriptions"])


def _validate_upload(file: UploadFile, settings: Settings) -> str:
    """Validate extension and return the sanitized lowercase extension."""
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a filename.",
        )
    ext = Path(file.filename).suffix.lower().lstrip(".")
    if ext not in settings.allowed_extensions:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"Unsupported file type '.{ext}'. "
                f"Allowed: {', '.join(settings.allowed_extensions)}"
            ),
        )
    return ext


async def _persist_upload(
    file: UploadFile, dest_dir: Path, ext: str, max_bytes: int
) -> Path:
    """Stream the upload to disk while enforcing the size limit."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / f"{uuid.uuid4().hex}.{ext}"

    total = 0
    chunk_size = 1024 * 1024  # 1 MiB
    try:
        with dest.open("wb") as out:
            while True:
                chunk = await file.read(chunk_size)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    out.close()
                    dest.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds maximum size of {max_bytes // (1024 * 1024)} MB.",
                    )
                out.write(chunk)
    finally:
        await file.close()

    return dest


def _resolve_profile(profile: Optional[str]) -> tuple[TranscriptionProfile, int]:
    """Map a UI profile name to enum + beam size (single source of truth)."""
    if not profile:
        chosen = TranscriptionProfile.PRECISE
    else:
        try:
            chosen = TranscriptionProfile(profile.lower())
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid profile '{profile}'. Use: quick, standard, precise.",
            ) from exc
    return chosen, PROFILE_BEAM_SIZES[chosen]


async def _create_job_from_upload(
    *,
    file: UploadFile,
    language: Optional[str],
    profile: Optional[str],
    include_timestamps: bool,
    settings: Settings,
    job_store: JobStore,
) -> tuple[Path, Job]:
    """Shared upload + job creation used by async and sync endpoints."""
    ext = _validate_upload(file, settings)
    audio_path = await _persist_upload(
        file,
        dest_dir=settings.upload_dir,
        ext=ext,
        max_bytes=settings.max_upload_mb * 1024 * 1024,
    )
    chosen_profile, beam_size = _resolve_profile(profile)
    job = await job_store.create(
        filename=file.filename or audio_path.name,
        audio_path=audio_path,
        language=normalize_language(language),
        profile=chosen_profile,
        beam_size=beam_size,
        include_timestamps=include_timestamps,
    )
    return audio_path, job


@router.get(
    "",
    response_model=JobListResponse,
    summary="List recent transcription jobs",
)
async def list_transcriptions(
    limit: int = 100,
    job_store: JobStore = Depends(get_job_store),
) -> JobListResponse:
    jobs = await job_store.list_all(limit=limit)
    items = [j.to_info() for j in jobs]
    return JobListResponse(jobs=items, total=len(items))


@router.post(
    "",
    response_model=JobCreated,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Upload an audio file for asynchronous transcription",
)
async def create_transcription(
    request: Request,
    file: UploadFile = File(..., description="Audio file to transcribe."),
    language: Optional[str] = Form(
        default=None,
        description="Optional ISO 639-1 language code (e.g. 'en'). Auto-detected if omitted.",
    ),
    profile: Optional[str] = Form(
        default="precise",
        description="Speed vs accuracy: quick | standard | precise.",
    ),
    include_timestamps: bool = Form(
        default=False,
        description="Include time ranges in transcript view and TXT export.",
    ),
    settings: Settings = Depends(get_settings_dep),
    job_store: JobStore = Depends(get_job_store),
    worker: TranscriptionWorker = Depends(get_worker),
) -> JobCreated:
    _, job = await _create_job_from_upload(
        file=file,
        language=language,
        profile=profile,
        include_timestamps=include_timestamps,
        settings=settings,
        job_store=job_store,
    )
    worker.enqueue(job)
    logger.info("Job %s queued for file '%s'", job.id, job.filename)

    base = str(request.url_for("get_transcription", job_id=job.id))
    return JobCreated(
        job_id=job.id,
        status=job.status,
        filename=job.filename,
        created_at=job.created_at,
        poll_url=base,
        result_url=base + "/result",
    )


@router.post(
    "/sync",
    response_model=TranscriptionResult,
    summary="Upload an audio file and wait for the transcription synchronously",
)
async def create_transcription_sync(
    file: UploadFile = File(...),
    language: Optional[str] = Form(default=None),
    profile: Optional[str] = Form(default="precise"),
    include_timestamps: bool = Form(default=False),
    settings: Settings = Depends(get_settings_dep),
    job_store: JobStore = Depends(get_job_store),
    worker: TranscriptionWorker = Depends(get_worker),
) -> TranscriptionResult:
    _, job = await _create_job_from_upload(
        file=file,
        language=language,
        profile=profile,
        include_timestamps=include_timestamps,
        settings=settings,
        job_store=job_store,
    )
    task = worker.enqueue(job)
    await task

    refreshed = await job_store.get(job.id)
    assert refreshed is not None
    if refreshed.status is JobStatus.FAILED or refreshed.result is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=refreshed.error or "Transcription failed.",
        )
    return refreshed.result


@router.get(
    "/{job_id}",
    response_model=JobInfo,
    name="get_transcription",
    summary="Get the status (and result if finished) of a transcription job",
)
async def get_transcription(
    job_id: str,
    job_store: JobStore = Depends(get_job_store),
) -> JobInfo:
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    return job.to_info()


@router.get(
    "/{job_id}/result",
    response_model=TranscriptionResult,
    summary="Fetch the final transcript (409 if the job hasn't finished)",
)
async def get_transcription_result(
    job_id: str,
    job_store: JobStore = Depends(get_job_store),
) -> TranscriptionResult:
    job = await job_store.get(job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    if job.status is JobStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=job.error or "Transcription failed.",
        )
    if job.status is not JobStatus.COMPLETED or job.result is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job is '{job.status.value}', result not ready yet.",
        )
    return job.result


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    response_class=Response,
    summary="Delete a job and its uploaded audio file",
)
async def delete_transcription(
    job_id: str,
    job_store: JobStore = Depends(get_job_store),
) -> Response:
    removed = await job_store.delete(job_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job '{job_id}' not found.",
        )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
