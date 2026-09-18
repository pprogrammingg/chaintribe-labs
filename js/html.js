export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

export function fetchJson(url) {
  return fetch(url).then((res) => {
    if (!res.ok) throw new Error(`Could not load ${url}`);
    return res.json();
  });
}
