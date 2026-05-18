/**
 * Recent files table — polls active jobs and re-renders from API.
 */

import { deleteJob, getJob, listJobs } from "./api.js";
import { renderEmptyState, renderJobRow } from "./components.js";
import { $, closeModal, formatDuration, openModal } from "./dom.js";

export class Dashboard {
  constructor({ tableBody, emptyMount, transcriptModal }) {
    this.tableBody = tableBody;
    this.emptyMount = emptyMount;
    this.transcriptModal = transcriptModal;
    this.pollTimer = null;
    this.jobs = [];
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
          onDelete: (j) => this._delete(j),
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

    $("#transcript-title").textContent = current.filename;
    $("#transcript-meta").textContent = [
      formatDuration(current.result?.duration),
      current.result?.language?.toUpperCase(),
    ]
      .filter(Boolean)
      .join(" · ");

    $("#transcript-body").textContent = current.result?.text || "(empty transcript)";
    openModal(this.transcriptModal);
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
