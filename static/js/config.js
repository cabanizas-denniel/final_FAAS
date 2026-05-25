/**
 * Single source of truth for frontend constants (DRY).
 * Keep ALLOWED_EXTENSIONS in sync with app/core/media.py
 * Profile → beam_size mirrors app/models/schemas.py
 */
export const API = {
  transcriptions: "/transcriptions",
};

export const ALLOWED_EXTENSIONS = [
  "wav",
  "mp3",
  "m4a",
  "flac",
  "ogg",
  "webm",
  "mp4",
  "mov",
  "aac",
  "mpeg",
  "mpg",
  "wma",
  "wmv",
];

export const ALLOWED_EXT = ALLOWED_EXTENSIONS.join(", ");

export const PROFILES = [
  { id: "quick", emoji: "⚡", name: "Quick", tag: "Fastest" },
  { id: "standard", emoji: "⚖️", name: "Standard", tag: "Balanced" },
  { id: "precise", emoji: "🔬", name: "Precise", tag: "Most accurate" },
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

export function fileExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isAllowedUpload(name) {
  return ALLOWED_EXTENSIONS.includes(fileExtension(name));
}
