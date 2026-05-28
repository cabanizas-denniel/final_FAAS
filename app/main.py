"""FastAPI application entry point — FaaS orchestrator."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app import __version__
from app.api.routes import health, transcription
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.job_store import JobStore
from app.workers.tasks import TranscriptionWorker

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    configure_logging(settings.log_level)
    logger.info("Starting %s v%s", settings.app_name, __version__)

    settings.upload_dir.mkdir(parents=True, exist_ok=True)

    job_store = JobStore(
        retention_seconds=settings.job_retention_seconds,
        persist_dir=settings.upload_dir / "jobs",
    )
    worker = TranscriptionWorker(
        job_store=job_store,
        max_concurrent=settings.max_concurrent_jobs,
    )

    app.state.settings = settings
    app.state.job_store = job_store
    app.state.worker = worker

    pruner = asyncio.create_task(_prune_loop(job_store), name="job-pruner")
    try:
        yield
    finally:
        logger.info("Shutting down %s", settings.app_name)
        pruner.cancel()
        try:
            await pruner
        except asyncio.CancelledError:
            pass


async def _prune_loop(job_store: JobStore, interval_seconds: int = 300) -> None:
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            removed = await job_store.prune_expired()
            if removed:
                logger.info("Pruned %d expired jobs", removed)
        except asyncio.CancelledError:
            raise
        except Exception:  # noqa: BLE001
            logger.exception("Job pruner iteration failed")


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description=(
            "Function-as-a-Service audio transcription — each transcription "
            "runs in its own ephemeral Docker container."
        ),
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(transcription.router)

    static_dir = Path(__file__).resolve().parent.parent / "static"
    if static_dir.is_dir():
        app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")

        @app.get("/", include_in_schema=False)
        async def serve_dashboard() -> FileResponse:
            return FileResponse(static_dir / "index.html")
    else:
        @app.get("/", include_in_schema=False)
        async def root() -> dict[str, str]:
            return {"name": settings.app_name, "version": __version__, "docs": "/docs"}

    return app


app = create_app()
