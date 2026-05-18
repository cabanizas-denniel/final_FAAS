/**
 * API client — all HTTP calls live here (DRY).
 */

import { API, PROGRESS } from "./config.js";

async function parseJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data.detail ?? res.statusText;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

export async function fetchHealth() {
  const res = await fetch(API.health);
  return parseJson(res);
}

export async function listJobs(limit = 100) {
  const res = await fetch(`${API.transcriptions}?limit=${limit}`);
  return parseJson(res);
}

export async function getJob(jobId) {
  const res = await fetch(`${API.transcriptions}/${jobId}`);
  return parseJson(res);
}

export async function deleteJob(jobId) {
  const res = await fetch(`${API.transcriptions}/${jobId}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) await parseJson(res);
}

/**
 * Upload with XMLHttpRequest so we get upload progress events.
 * Returns the JobCreated payload.
 */
export function uploadTranscription(file, { language, profile, onUploadProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const form = new FormData();
    form.append("file", file);
    const lang = (language || "").trim();
    if (lang) form.append("language", lang);
    form.append("profile", profile || "whale");

    xhr.open("POST", API.transcriptions);

    xhr.upload.addEventListener("progress", (e) => {
      if (!e.lengthComputable || !onUploadProgress) return;
      const ratio = e.loaded / e.total;
      onUploadProgress(ratio * PROGRESS.uploadWeight * 100);
    });

    xhr.addEventListener("load", () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new Error(data.detail || xhr.statusText));
      } catch {
        reject(new Error("Invalid server response"));
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.send(form);
  });
}

/** Poll until job reaches a terminal state. */
export async function pollUntilDone(jobId, { onProgress, signal }) {
  const terminal = new Set(["completed", "failed"]);

  while (!signal?.aborted) {
    const job = await getJob(jobId);
    if (onProgress) onProgress(job);

    if (terminal.has(job.status)) return job;

    await new Promise((r) => setTimeout(r, PROGRESS.pollIntervalMs));
  }

  throw new Error("Polling cancelled");
}
