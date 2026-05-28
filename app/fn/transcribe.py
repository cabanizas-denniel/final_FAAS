"""
FaaS worker function — runs once inside an ephemeral container per invocation.

The orchestrator (main app) provisions this container on every transcription
request.  When the function returns, the container is automatically removed.
"""
import os
from pathlib import Path


def main() -> None:
    audio = Path(os.environ["AUDIO_PATH"])
    out   = Path(os.environ["RESULT_PATH"])
    lang  = os.environ.get("LANGUAGE") or None
    beam  = int(os.environ.get("BEAM_SIZE", "5"))

    from app.core.config import get_settings
    from app.services.transcriber import Transcriber

    result = Transcriber(get_settings()).transcribe(audio, language=lang, beam_size=beam)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(result.model_dump_json(), encoding="utf-8")


if __name__ == "__main__":
    main()
