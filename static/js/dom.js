/**
 * Tiny DOM helpers — avoid repeating querySelector / createElement boilerplate.
 */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === "className") node.className = val;
    else if (key === "text") node.textContent = val;
    else if (key === "html") node.innerHTML = val;
    else if (key.startsWith("on") && typeof val === "function")
      node.addEventListener(key.slice(2).toLowerCase(), val);
    else node.setAttribute(key, val);
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export function toggleClass(node, cls, on) {
  node.classList.toggle(cls, on);
}

export function openModal(backdrop) {
  backdrop.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

export function closeModal(backdrop) {
  backdrop.classList.remove("is-open");
  document.body.style.overflow = "";
}

export function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDuration(seconds) {
  if (seconds == null) return "—";
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
}
