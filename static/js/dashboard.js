/**
 * Recent files table — polls active jobs and re-renders from API.
 */

import { deleteJob, getJob, listJobs } from "./api.js";
import { renderEmptyState, renderJobRow } from "./components.js";
import { $, $$, closeModal, formatDuration, openModal } from "./dom.js";
import {
  baseName,
  downloadText,
  formatSrt,
  formatTranscriptDisplay,
  formatTxt,
} from "./export.js";

export class Dashboard {
  constructor({ tableBody, emptyMount, transcriptModal }) {
    this.tableBody = tableBody;
    this.emptyMount = emptyMount;
    this.transcriptModal = transcriptModal;
    this.pollTimer = null;
    this.jobs = [];
    this.activeJob = null;

    $("#btn-download-txt")?.addEventListener("click", () => this._downloadTxt());
    $("#btn-download-srt")?.addEventListener("click", () => this._downloadSrt());

    document.addEventListener("click", () => this._closeDownloadMenus());
  }

  _closeDownloadMenus() {
    $$(".download-menu").forEach((m) => m.classList.add("hidden"));
  }

  _toggleDownloadMenu(menu, anchor) {
    const wasOpen = !menu.classList.contains("hidden");
    this._closeDownloadMenus();
    if (!wasOpen) {
      menu.classList.remove("hidden");
      const rect = anchor.getBoundingClientRect();
      const menuWidth = menu.offsetWidth || 160;
      menu.style.top = `${rect.bottom + 4}px`;
      menu.style.left = `${Math.max(8, rect.right - menuWidth)}px`;
    }
  }

  start() {
    this.refresh();
    this.pollTimer = setInterval(() => this.refresh(), 4000);
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  async refresh() {
    try {
      const data = await listJobs();
      this.jobs = data.jobs || [];
      this._render();
    } catch (err) {
      console.warn("Could not load jobs", err);
    }
  }

  _render() {
    this.tableBody.replaceChildren();

    if (!this.jobs.length) {
      this.emptyMount.classList.remove("hidden");
      this.emptyMount.replaceChildren(renderEmptyState());
      return;
    }

    this.emptyMount.classList.add("hidden");

    for (const job of this.jobs) {
      this.tableBody.append(
        renderJobRow(job, {
          onClick: (j) => this._showTranscript(j),
          onDownloadTxt: (j) => this._downloadTxt(j),
          onDownloadSrt: (j) => this._downloadSrt(j),
          onDelete: (j) => this._delete(j),
          onToggleMenu: (menu, btn) => this._toggleDownloadMenu(menu, btn),
        })
      );
    }
  }

  async _showTranscript(job) {
    let current = job;
    if (current.status !== "completed" || !current.result) {
      try {
        current = await getJob(job.job_id);
      } catch {
        alert("Could not load job details.");
        return;
      }
    }

    if (current.status === "processing" || current.status === "queued") {
      alert("This file is still being transcribed. Please wait.");
      return;
    }
    if (current.status === "failed") {
      alert(current.error || "Transcription failed.");
      return;
    }

    this.activeJob = current;

    $("#transcript-title").textContent = current.filename;
    const tsLabel = current.include_timestamps ? "Timestamps on" : "Plain text";
    $("#transcript-meta").textContent = [
      formatDuration(current.result?.duration),
      current.result?.language?.toUpperCase(),
      tsLabel,
    ]
      .filter(Boolean)
      .join(" · ");

    $("#transcript-body").textContent = formatTranscriptDisplay(
      current.result,
      current.include_timestamps
    );
    openModal(this.transcriptModal);
  }

  async _resolveJob(job) {
    if (job.status === "completed" && job.result) return job;
    try {
      return await getJob(job.job_id);
    } catch {
      alert("Could not load job details.");
      return null;
    }
  }

  async _downloadTxt(job = this.activeJob) {
    const current = await this._resolveJob(job);
    if (!current?.result) {
      alert("Transcript not ready yet.");
      return;
    }
    const content = formatTxt(current.result, current.include_timestamps);
    downloadText(content, `${baseName(current.filename)}.txt`);
  }

  async _downloadSrt(job = this.activeJob) {
    const current = await this._resolveJob(job);
    if (!current?.result) {
      alert("Transcript not ready yet.");
      return;
    }
    const content = formatSrt(current.result);
    if (!content.trim()) {
      alert("No timed segments available for SRT export.");
      return;
    }
    downloadText(content, `${baseName(current.filename)}.srt`);
  }

  async _delete(job) {
    if (!confirm(`Delete "${job.filename}"?`)) return;
    try {
      await deleteJob(job.job_id);
      await this.refresh();
    } catch (err) {
      alert(err.message || "Delete failed.");
    }
  }
}
