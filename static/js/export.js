/**
 * Transcript export helpers (SRT, TXT, on-screen display).
 */

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Seconds → SRT timecode HH:MM:SS,mmm */
export function toSrtTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = Math.round((s % 1) * 1000);
  return `${pad2(h)}:${pad2(m)}:${pad2(sec)},${String(ms).padStart(3, "0")}`;
}

/** Seconds → MM:SS.mmm (or HH:MM:SS.mmm when needed) for TXT / UI */
export function toDisplayTime(seconds) {
  const s = Math.max(0, Number(seconds) || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const ms = String(Math.round((s % 1) * 1000)).padStart(3, "0");
  if (h > 0) {
    return `${pad2(h)}:${pad2(m)}:${pad2(sec)}.${ms}`;
  }
  return `${pad2(m)}:${pad2(sec)}.${ms}`;
}

/** One segment: timestamp line, then text on the next line. */
export function formatTimestampBlock(seg) {
  const line = `[${toDisplayTime(seg.start)} - ${toDisplayTime(seg.end)}]`;
  return `${line}\n${seg.text.trim()}`;
}

export function formatTranscriptDisplay(result, includeTimestamps) {
  if (!result) return "(empty transcript)";
  const segments = result.segments || [];
  if (includeTimestamps && segments.length) {
    return segments.map(formatTimestampBlock).join("\n\n");
  }
  return result.text?.trim() || "(empty transcript)";
}

export function formatTxt(result, includeTimestamps) {
  if (!result) return "";
  const segments = result.segments || [];
  if (includeTimestamps && segments.length) {
    return segments.map(formatTimestampBlock).join("\n\n");
  }
  return result.text?.trim() || "";
}

export function formatSrt(result) {
  const segments = result?.segments || [];
  if (!segments.length) {
    const text = result?.text?.trim() || "";
    if (!text) return "";
    return `1\n00:00:00,000 --> 00:00:10,000\n${text}\n`;
  }
  return segments
    .map((seg, i) => {
      const start = toSrtTime(seg.start);
      const end = toSrtTime(seg.end);
      const text = seg.text.trim();
      return `${i + 1}\n${start} --> ${end}\n${text}`;
    })
    .join("\n\n")
    .concat("\n");
}

export function downloadText(content, filename) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function baseName(filename) {
  const name = filename || "transcript";
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}
