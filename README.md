# Audio Transcription FaaS

A lightweight, locally-runnable Function-as-a-Service for audio transcription.
Built with **FastAPI** and **faster-whisper**, packaged with **Docker** and
**docker-compose**, and fully configurable through environment variables.

## Features

- REST API for audio upload and transcription
- Async job processing with bounded concurrency (semaphore-controlled)
- Both **async** (`POST /transcriptions`) and **sync** (`POST /transcriptions/sync`) modes
- Auto language detection (or override per-request)
- Returns full text **and** timed segments
- Dockerized with a slim Python image and an `ffmpeg` runtime
- Model cached in a named Docker volume so it isn't re-downloaded on restart
- Health-check endpoint and Docker `HEALTHCHECK`
- 12-factor configuration via `.env`

## Project Layout

```
finalproject/
├── app/
│   ├── api/
│   │   ├── dependencies.py        # FastAPI dependency providers
│   │   └── routes/
│   │       ├── health.py          # GET /health
│   │       └── transcription.py   # POST/GET/DELETE /transcriptions/*
│   ├── core/
│   │   ├── config.py              # Pydantic Settings (reads .env)
│   │   └── logging.py             # Logging setup
│   ├── models/
│   │   └── schemas.py             # Pydantic request/response models
│   ├── services/
│   │   ├── job_store.py           # Async in-memory job registry
│   │   └── transcriber.py         # faster-whisper wrapper
│   ├── workers/
│   │   └── tasks.py               # Background transcription worker
│   └── main.py                    # FastAPI app factory & lifespan
├── static/                        # HTML/CSS/JS web UI
│   ├── index.html
│   ├── css/                       # tokens, components, layout (DRY)
│   └── js/                        # api, components, upload, dashboard
├── uploads/                       # Volume mount for uploaded audio
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── .env.example
├── .dockerignore
└── .gitignore
```

## Quickstart (Docker)

```bash
cp .env.example .env       # tweak values as needed
docker compose up --build
```

The API is now available at <http://localhost:8000>:

- **Web UI (TurboScribe-style):** <http://localhost:8000/>
- Interactive docs: <http://localhost:8000/docs>
- OpenAPI schema: <http://localhost:8000/openapi.json>
- Health check: <http://localhost:8000/health>

> The first start downloads the Whisper model (≈75 MB for `tiny`, larger for
> bigger sizes) into the `whisper-cache` volume. Subsequent restarts are fast.

## Quickstart (Local Python)

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env

uvicorn app.main:app --reload
```

> Local runs also require `ffmpeg` on your system PATH for most audio formats.

## API

### `POST /transcriptions` &nbsp;— async (recommended)

Upload an audio file. Returns immediately with a `job_id` you can poll.

```bash
curl -X POST http://localhost:8000/transcriptions \
  -F "file=@sample.mp3" \
  -F "language=en"          # optional; auto-detected if omitted
```

Response `202 Accepted`:

```json
{
  "job_id": "a1b2c3...",
  "status": "queued",
  "filename": "sample.mp3",
  "created_at": "2026-05-18T10:00:00Z",
  "poll_url": "http://localhost:8000/transcriptions/a1b2c3...",
  "result_url": "http://localhost:8000/transcriptions/a1b2c3.../result"
}
```

### `GET /transcriptions/{job_id}` &nbsp;— poll status

```bash
curl http://localhost:8000/transcriptions/a1b2c3...
```

Returns the current `status` (`queued`, `processing`, `completed`, `failed`)
and the embedded `result` once finished.

### `GET /transcriptions/{job_id}/result` &nbsp;— fetch transcript only

Returns `409 Conflict` if the job hasn't finished yet, or `500` on failure.

### `POST /transcriptions/sync` &nbsp;— wait inline

Blocks until the transcription completes and returns the result directly.
Best for quick clips; for longer audio prefer the async flow.

```bash
curl -X POST http://localhost:8000/transcriptions/sync \
  -F "file=@sample.mp3"
```

### `DELETE /transcriptions/{job_id}` &nbsp;— cleanup

Removes the job record and the stored audio file.

### `GET /health`

```json
{
  "status": "ok",
  "app": "Audio Transcription FaaS",
  "version": "0.1.0",
  "model": "tiny",
  "device": "cpu",
  "model_loaded": true
}
```

## Configuration (`.env`)

| Variable                | Default                   | Description                                                  |
| ----------------------- | ------------------------- | ------------------------------------------------------------ |
| `APP_NAME`              | `Audio Transcription FaaS`| Display name shown in OpenAPI & `/health`.                   |
| `API_HOST`              | `0.0.0.0`                 | Bind host inside the container.                              |
| `API_PORT`              | `8000`                    | Bind port (also the host-side port via compose).             |
| `LOG_LEVEL`             | `INFO`                    | Python log level.                                            |
| `UPLOAD_DIR`            | `uploads`                 | Where uploaded audio is stored.                              |
| `MAX_UPLOAD_MB`         | `50`                      | Per-upload size cap (enforced while streaming to disk).      |
| `WHISPER_MODEL`         | `tiny`                    | `tiny`, `base`, `small`, `medium`, `large-v3`.               |
| `WHISPER_DEVICE`        | `cpu`                     | `cpu`, `cuda`, or `auto`.                                    |
| `WHISPER_COMPUTE_TYPE`  | `int8`                    | `int8` (CPU), `float16` (GPU), `float32`, etc.               |
| `WHISPER_LANGUAGE`      | *(empty)*                 | Force a language code; empty enables auto-detection.         |
| `WHISPER_BEAM_SIZE`     | `1`                       | Higher = more accurate but slower.                           |
| `MAX_CONCURRENT_JOBS`   | `2`                       | Semaphore cap on parallel transcriptions.                    |
| `JOB_RETENTION_SECONDS` | `3600`                    | Finished jobs are pruned after this many seconds.            |

## Supported Audio Formats

`wav`, `mp3`, `m4a`, `flac`, `ogg`, `webm`, `mp4` (decoded via `ffmpeg`).

## Production Notes

- For multi-replica deployments, swap `JobStore` for Redis or a database
  (the interface is small and easy to re-implement).
- For heavier loads, bump `WHISPER_MODEL` to `small`/`medium` and run on a
  GPU image with `WHISPER_DEVICE=cuda` and `WHISPER_COMPUTE_TYPE=float16`.
- Put the service behind a reverse proxy (Caddy / Traefik / Nginx) and
  restrict CORS origins in `app/main.py`.
