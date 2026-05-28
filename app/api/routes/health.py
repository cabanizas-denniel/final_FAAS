"""Health / readiness endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app import __version__
from app.api.dependencies import get_settings_dep
from app.core.config import Settings
from app.models.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health(settings: Settings = Depends(get_settings_dep)) -> HealthResponse:
    try:
        import docker
        docker.from_env().ping()
        docker_ok = True
    except Exception:
        docker_ok = False

    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=__version__,
        model=settings.whisper_model,
        device=settings.whisper_device,
        docker_available=docker_ok,
    )
