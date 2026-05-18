/**
 * Single source of truth for frontend constants (DRY).
 * Backend mirrors profile → beam_size in app/models/schemas.py
 */
export const API = {
  transcriptions: "/transcriptions",
};

export const PROFILES = [
  { id: "cheetah", emoji: "🐆", name: "Cheetah", tag: "⚡ Fastest" },
  { id: "dolphin", emoji: "🐬", name: "Dolphin", tag: "✅ Balanced" },
  { id: "whale", emoji: "🐋", name: "Whale", tag: "⭐ Most Accurate" },
];

export const LANGUAGES = [
  { code: "", label: "Auto-detect" },
  { code: "en", label: "English 🇺🇸" },
  { code: "tl", label: "Filipino / Tagalog 🇵🇭" },
  { code: "es", label: "Spanish 🇪🇸" },
  { code: "fr", label: "French 🇫🇷" },
  { code: "de", label: "German 🇩🇪" },
  { code: "ja", label: "Japanese 🇯🇵" },
  { code: "ko", label: "Korean 🇰🇷" },
  { code: "zh", label: "Chinese 🇨🇳" },
];

export const ALLOWED_EXT =
  "mp3, mp4, m4a, mov, aac, wav, ogg, flac, webm, mpeg, wma, wmv";

export const STATUS = {
  queued: { label: "Queued", badge: "badge--muted", dot: "status-dot--queued" },
  processing: { label: "Processing", badge: "badge--warning", dot: "status-dot--processing" },
  completed: { label: "Done", badge: "badge--success", dot: "status-dot--completed" },
  failed: { label: "Failed", badge: "badge--danger", dot: "status-dot--failed" },
};

/** Upload phase ends at this percent; transcription fills the rest. */
export const PROGRESS = {
  uploadWeight: 0.4,
  pollIntervalMs: 1200,
};

export const PROFILE_EMOJI = Object.fromEntries(
  PROFILES.map((p) => [p.id, p.emoji])
);
