"""Health / readiness endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends

from app import __version__
from app.api.dependencies import get_settings_dep, get_transcriber
from app.core.config import Settings
from app.models.schemas import HealthResponse
from app.services.transcriber import Transcriber

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def health(
    settings: Settings = Depends(get_settings_dep),
    transcriber: Transcriber = Depends(get_transcriber),
) -> HealthResponse:
    return HealthResponse(
        status="ok",
        app=settings.app_name,
        version=__version__,
        model=settings.whisper_model,
        device=settings.whisper_device,
        model_loaded=transcriber.is_loaded,
    )
