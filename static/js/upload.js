/**
 * Upload modal controller — drag/drop, profile, progress.
 */

import { uploadTranscription, pollUntilDone } from "./api.js";
import { ALLOWED_EXT, LANGUAGES, PROFILES, PROGRESS } from "./config.js";
import { renderModeCards, renderProgressBar } from "./components.js";
import { $, closeModal, openModal } from "./dom.js";

export class UploadModal {
  constructor({ backdrop, onComplete }) {
    this.backdrop = backdrop;
    this.onComplete = onComplete;
    this.selectedProfile = "whale";
    this.selectedFile = null;
    this.abort = null;

    this.dropzone = $("#dropzone");
    this.fileInput = $("#file-input");
    this.languageSelect = $("#language-select");
    this.modeContainer = $("#mode-container");
    this.progressWrap = $("#upload-progress");
    this.submitBtn = $("#btn-transcribe");
    this.fileNameEl = $("#selected-filename");

    this._bind();
    this._renderModes();
    this._renderLanguages();
  }

  _bind() {
    $("#btn-open-upload")?.addEventListener("click", () => this.open());
    $("#btn-close-upload")?.addEventListener("click", () => this.close());
    this.backdrop.addEventListener("click", (e) => {
      if (e.target === this.backdrop) this.close();
    });

    this.dropzone.addEventListener("click", () => this.fileInput.click());
    this.fileInput.addEventListener("change", () => this._pickFile(this.fileInput.files[0]));

    this.dropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      this.dropzone.classList.add("is-dragover");
    });
    this.dropzone.addEventListener("dragleave", () => {
      this.dropzone.classList.remove("is-dragover");
    });
    this.dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      this.dropzone.classList.remove("is-dragover");
      const file = e.dataTransfer?.files?.[0];
      if (file) this._pickFile(file);
    });

    this.submitBtn.addEventListener("click", () => this._submit());
  }

  _renderModes() {
    this.modeContainer.replaceChildren(
      renderModeCards(PROFILES, this.selectedProfile, (id) => {
        this.selectedProfile = id;
        this._renderModes();
      })
    );
  }

  _renderLanguages() {
    this.languageSelect.replaceChildren(
      ...LANGUAGES.map((lang) => {
        const opt = document.createElement("option");
        opt.value = lang.code;
        opt.textContent = lang.label;
        return opt;
      })
    );
  }

  _pickFile(file) {
    if (!file) return;
    this.selectedFile = file;
    this.fileNameEl.textContent = file.name;
    this.fileNameEl.classList.remove("hidden");
    $("#dropzone-hint").textContent = ALLOWED_EXT;
  }

  open() {
    this._reset();
    openModal(this.backdrop);
  }

  close() {
    if (this.abort) this.abort.abort();
    closeModal(this.backdrop);
    this._reset();
  }

  _reset() {
    this.selectedFile = null;
    this.fileInput.value = "";
    this.fileNameEl.classList.add("hidden");
    this.progressWrap.classList.add("hidden");
    this.progressWrap.replaceChildren();
    this.submitBtn.disabled = false;
    this.submitBtn.textContent = "Transcribe";
  }

  async _submit() {
    if (!this.selectedFile) {
      alert("Please choose an audio or video file first.");
      return;
    }

    this.submitBtn.disabled = true;
    this.submitBtn.textContent = "Transcribing…";

    const progress = renderProgressBar({ percent: 0, label: "Uploading file…", id: "job-progress" });
    this.progressWrap.replaceChildren(progress);
    this.progressWrap.classList.remove("hidden");

    const controller = new AbortController();
    this.abort = controller;

    const uploadBase = PROGRESS.uploadWeight * 100;

    try {
      const created = await uploadTranscription(this.selectedFile, {
        language: this.languageSelect.value || undefined,
        profile: this.selectedProfile,
        onUploadProgress: (pct) => progress.setPercent(pct, "Uploading file…"),
      });

      progress.setPercent(uploadBase, "Transcribing audio…");

      const job = await pollUntilDone(created.job_id, {
        signal: controller.signal,
        onProgress: (j) => {
          let pct = uploadBase;
          if (j.status === "queued") pct = uploadBase + 8;
          else if (j.status === "processing") pct = uploadBase + 35;
          else if (j.status === "completed") pct = 100;
          progress.setPercent(pct, j.status === "processing" ? "Transcribing audio…" : "Finishing…");
        },
      });

      if (job.status === "failed") {
        throw new Error(job.error || "Transcription failed");
      }

      progress.setPercent(100, "Complete!");
      this.onComplete?.(job);
      setTimeout(() => this.close(), 600);
    } catch (err) {
      if (err.name !== "AbortError") {
        alert(err.message || "Something went wrong.");
      }
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = "Transcribe";
    }
  }
}
