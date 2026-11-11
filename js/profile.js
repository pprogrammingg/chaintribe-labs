import { mountChrome, markReady } from "./chrome.js";
import { fetchJson, escapeHtml } from "./html.js";
import { bindRail } from "./rail.js";

await mountChrome();
const profile = await fetchJson("data/profile.json");
const root = document.getElementById("page");

root.innerHTML = `
  <div class="rail-stage" id="rail-stage">
    <div id="image-track" class="rail-drawer" data-mouse-down-at="0" data-prev-percentage="0">
      <div class="rail-handle" aria-hidden="true" title="Drag">
        <span class="rail-handle-bar"></span>
        <span class="rail-handle-bar"></span>
        <span class="rail-handle-bar"></span>
      </div>
      ${profile.projects.map((project) => `
        <div class="rail-card" role="link" tabindex="0" data-href="blog.html#${escapeHtml(project.id)}" aria-label="${escapeHtml(project.title)}">
          <img class="rail-image" src="${escapeHtml(project.image)}" alt="${escapeHtml(project.alt)}" draggable="false" data-pan-skip="1">
          <span class="rail-overlay"><span class="rail-label">${escapeHtml(project.title)}</span></span>
        </div>
      `).join("")}
    </div>
  </div>
`;

bindRail(document.getElementById("image-track"), document.getElementById("rail-stage"));
markReady();
if (location.search.includes("check=1")) {
  window.__site = { projects: profile.projects.map((project) => project.id) };
}
