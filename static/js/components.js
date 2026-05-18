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

export function renderJobRow(job, { onClick, onDelete }) {
  const duration = job.result?.duration ?? null;
  const profile = job.profile || "whale";

  const row = el("tr", {
    "data-job-id": job.job_id,
    onClick: () => onClick?.(job),
  });

  row.append(
    el("td", {}, [el("input", { type: "checkbox", onClick: (e) => e.stopPropagation() })]),
    el("td", { className: "cell-name", text: job.filename }),
    el("td", { text: formatDate(job.created_at) }),
    el("td", { text: formatDuration(duration) }),
    el("td", { text: PROFILE_EMOJI[profile] || "🐋", title: profile }),
    renderStatusCell(job.status),
    el("td", {}, [
      el("button", {
        type: "button",
        className: "btn btn-ghost",
        text: "⋯",
        title: "Delete",
        onClick: (e) => {
          e.stopPropagation();
          onDelete?.(job);
        },
      }),
    ])
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
