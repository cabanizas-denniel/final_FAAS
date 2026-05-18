/**
 * Application bootstrap.
 */

import { closeModal } from "./dom.js";
import { Dashboard } from "./dashboard.js";
import { UploadModal } from "./upload.js";

function initTranscriptModal() {
  const modal = document.querySelector("#transcript-modal");
  document.querySelector("#btn-close-transcript")?.addEventListener("click", () => {
    closeModal(modal);
  });
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal);
  });
}

const dashboard = new Dashboard({
  tableBody: document.querySelector("#jobs-table-body"),
  emptyMount: document.querySelector("#empty-state"),
  transcriptModal: document.querySelector("#transcript-modal"),
});

const upload = new UploadModal({
  backdrop: document.querySelector("#upload-modal"),
  onComplete: () => dashboard.refresh(),
});

dashboard.start();
initTranscriptModal();

// Expose for debugging in browser console
window.__app = { dashboard, upload };
