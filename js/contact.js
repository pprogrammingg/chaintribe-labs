import { mountChrome, markReady } from "./chrome.js";
import { fetchJson, escapeHtml } from "./html.js";
import { createBeats, initCues, scrollToId } from "./section-scroll.js";

const site = await mountChrome();
const page = await fetchJson("data/contact.json");
const root = document.getElementById("page");
const channels = site.contact;

const beats = createBeats({
  root,
  chain: page.chain,
  render: (section) => (section.id === "reach" ? reachHtml() : collaborateHtml()),
});

function reachHtml() {
  return `
    <ul class="reach-list">
      <li>
        <span>Email</span>
        <a href="mailto:${escapeHtml(channels.email)}">${escapeHtml(channels.email)}</a>
      </li>
      <li>
        <span>Profile</span>
        <a href="${escapeHtml(channels.linkedin)}" target="_blank" rel="noopener">${escapeHtml(channels.linkedinLabel)}</a>
      </li>
    </ul>
  `;
}

function collaborateHtml() {
  return `
    <p class="eyebrow">${escapeHtml(page.collaborate.eyebrow)}</p>
    <h2 class="section-title">${escapeHtml(page.collaborate.title)}</h2>
    <p class="note">${escapeHtml(page.collaborate.body)}</p>
    <a class="text-link" href="${escapeHtml(channels.linkedin)}" target="_blank" rel="noopener">Full record on LinkedIn</a>
  `;
}

beats.mountThrough(page.chain[0].id);
const hash = location.hash.replace(/^#/, "");
if (hash && page.chain.some((section) => section.id === hash)) beats.mountThrough(hash);

initCues({
  chain: page.chain,
  detect: () => beats.detect(),
  ensure: async (id) => {
    beats.mountThrough(id);
  },
  scrollToId,
});

markReady();
if (location.search.includes("check=1")) {
  window.__site = { mounted: () => beats.mounted };
}
