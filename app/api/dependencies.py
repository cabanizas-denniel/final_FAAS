"""FastAPI dependency providers.

These read singletons that were attached to `app.state` during the lifespan
startup phase, so handlers don't have to import them directly.
"""

from __future__ import annotations

from fastapi import Request

from app.core.config import Settings
from app.services.job_store import JobStore
from app.services.transcriber import Transcriber
from app.workers.tasks import TranscriptionWorker


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store


def get_transcriber(request: Request) -> Transcriber:
    return request.app.state.transcriber


def get_worker(request: Request) -> TranscriptionWorker:
    return request.app.state.worker
