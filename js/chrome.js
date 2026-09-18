import { escapeHtml, fetchJson } from "./html.js";
import { bindImageWindows } from "./elastic-pan.js";

export async function mountChrome() {
  const site = await fetchJson("data/site.json");
  const page = document.body.dataset.page;
  const header = document.getElementById("site-header");
  const links = site.nav.map((item) => {
    const current = item.id === page ? ' aria-current="page"' : "";
    return `<a href="${escapeHtml(item.href)}"${current}>${escapeHtml(item.label)}</a>`;
  }).join("");

  header.innerHTML = `
    <a class="wordmark" href="index.html">${escapeHtml(site.practice)}</a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">
      <span></span>
      <span class="visually-hidden">Menu</span>
    </button>
    <nav class="site-nav" id="site-nav" aria-label="Main">${links}</nav>
  `;

  const toggle = header.querySelector(".nav-toggle");
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  });

  if (!document.getElementById("cue-down")) {
    document.body.insertAdjacentHTML("beforeend", `
      <a class="cue cue--up" id="cue-up" hidden href="#top"></a>
      <a class="cue cue--down" id="cue-down" hidden href="#top"></a>
    `);
  }

  document.title = pageTitle(site, page);
  bindImageWindows();
  return site;
}

function pageTitle(site, page) {
  const label = site.nav.find((item) => item.id === page)?.label || site.practice;
  return `${label} — ${site.name}`;
}

export function markReady() {
  document.body.classList.add("is-ready");
}
