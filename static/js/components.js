/**
 * Reusable render functions — one place for UI fragments (DRY).
 */

import { STATUS, PROFILE_EMOJI } from "./config.js";
import { el, formatDate, formatDuration } from "./dom.js";

export function renderProgressBar({ percent = 0, label = "Progress", id = null }) {
  const root = el("div", { className: "progress-block" });
  if (id) root.id = id;

  const labelRow = el("div", { className: "progress-label" }, [
    el("span", { className: "progress-label-text", text: label }),
    el("span", { className: "progress-pct", text: `${Math.round(percent)}%` }),
  ]);

  const barEl = el("div", { className: "progress__bar" });
  barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  const track = el("div", { className: "progress progress--lg" }, [barEl]);

  root.append(labelRow, track);

  root.setPercent = (p, text) => {
    const v = Math.min(100, Math.max(0, p));
    barEl.style.width = `${v}%`;
    const pct = root.querySelector(".progress-pct");
    if (pct) pct.textContent = `${Math.round(v)}%`;
    if (text) {
      const lbl = root.querySelector(".progress-label-text");
      if (lbl) lbl.textContent = text;
    }
  };

  return root;
}

export function renderStatusCell(status) {
  const meta = STATUS[status] || STATUS.queued;
  return el("td", {}, [
    el("span", { className: `status-dot ${meta.dot}`, title: meta.label }),
  ]);
}

const ICON_DOWNLOAD = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3a1 1 0 0 1 1 1v9.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42l2.3 2.3V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v2h12v-2a1 1 0 1 1 2 0v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z"/></svg>`;
const ICON_DELETE = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M9 3a1 1 0 0 0-1 1H5a1 1 0 0 0 0 2h1v13a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6h1a1 1 0 1 0 0-2h-3a1 1 0 0 0-1-1H9Zm2 3h2v13h-2V6Zm4 0h2v13h-2V6Z"/></svg>`;

function iconButton({ className, title, html, disabled = false, onClick }) {
  return el("button", {
    type: "button",
    className: `btn-icon ${className || ""}`.trim(),
    title,
    "aria-label": title,
    disabled: disabled ? true : undefined,
    html,
    onClick,
  });
}

function isJobDownloadable(job) {
  const status = String(job?.status ?? "").toLowerCase();
  return status === "completed" || !!(job?.result?.text || job?.result?.segments?.length);
}

function renderRowActions(job, { onDownloadTxt, onDownloadSrt, onDelete, onToggleMenu }) {
  const canDownload = isJobDownloadable(job);
  const wrap = el("div", { className: "row-actions" });

  const menu = el("div", { className: "download-menu hidden" }, [
    el("button", {
      type: "button",
      className: "download-menu__item",
      text: "Download TXT",
      onClick: (e) => {
        e.stopPropagation();
        menu.classList.add("hidden");
        onDownloadTxt?.(job);
      },
    }),
    el("button", {
      type: "button",
      className: "download-menu__item",
      text: "Download SRT",
      onClick: (e) => {
        e.stopPropagation();
        menu.classList.add("hidden");
        onDownloadSrt?.(job);
      },
    }),
  ]);

  const downloadWrap = el("div", { className: "row-actions__download" }, [
    iconButton({
      className: canDownload ? "" : "is-disabled",
      title: canDownload ? "Download transcript" : "Available when transcription completes",
      html: ICON_DOWNLOAD,
      disabled: !canDownload,
      onClick: (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!canDownload) return;
        onToggleMenu?.(menu, e.currentTarget);
      },
    }),
    menu,
  ]);

  wrap.append(
    downloadWrap,
    iconButton({
      className: "btn-icon--danger",
      title: "Delete",
      html: ICON_DELETE,
      onClick: (e) => {
        e.stopPropagation();
        onDelete?.(job);
      },
    })
  );

  return el("td", {
    className: "cell-actions",
    onClick: (e) => e.stopPropagation(),
  }, [wrap]);
}

export function renderJobRow(job, { onClick, onDownloadTxt, onDownloadSrt, onDelete, onToggleMenu }) {
  const duration = job.result?.duration ?? null;
  const profile = job.profile || "precise";

  const row = el("tr", {
    "data-job-id": job.job_id,
    onClick: () => onClick?.(job),
  });

  row.append(
    el("td", {}, [el("input", { type: "checkbox", onClick: (e) => e.stopPropagation() })]),
    el("td", { className: "cell-name", text: job.filename }),
    el("td", { text: formatDate(job.created_at) }),
    el("td", { text: formatDuration(duration) }),
    el("td", { text: PROFILE_EMOJI[profile] || "🔬", title: profile }),
    renderStatusCell(job.status),
    renderRowActions(job, { onDownloadTxt, onDownloadSrt, onDelete, onToggleMenu })
  );

  return row;
}

export function renderEmptyState(message = "No transcriptions yet.") {
  return el("div", { className: "empty-state" }, [
    el("div", { className: "empty-state__icon", text: "🎙️" }),
    el("p", { text: message }),
    el("p", { text: 'Click "Transcribe Files" to upload your first audio.' }),
  ]);
}

export function renderModeCards(profiles, selectedId, onSelect) {
  const grid = el("div", { className: "mode-grid" });

  for (const p of profiles) {
    grid.append(
      el("button", {
        type: "button",
        className: `mode-card${p.id === selectedId ? " is-selected" : ""}`,
        "data-profile": p.id,
        onClick: () => onSelect(p.id),
      }, [
        el("span", { className: "mode-card__emoji", text: p.emoji }),
        el("span", { className: "mode-card__name", text: p.name }),
        el("span", { className: "mode-card__tag", text: p.tag }),
      ])
    );
  }

  return grid;
}
