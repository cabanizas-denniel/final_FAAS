"""FastAPI dependency providers."""

from __future__ import annotations

from fastapi import Request

from app.core.config import Settings
from app.services.job_store import JobStore
from app.workers.tasks import TranscriptionWorker


def get_settings_dep(request: Request) -> Settings:
    return request.app.state.settings


def get_job_store(request: Request) -> JobStore:
    return request.app.state.job_store


def get_worker(request: Request) -> TranscriptionWorker:
    return request.app.state.worker
