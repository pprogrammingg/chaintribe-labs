import { escapeHtml } from "./html.js";

export function videoFrame({ youtubeId, title, deferred = false }) {
  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(youtubeId)}`;
  const srcAttr = deferred ? `data-src="${src}"` : `src="${src}"`;
  return `<figure class="video-frame">
    <div class="video-frame__ratio">
      <iframe ${srcAttr} title="${escapeHtml(title)}" loading="lazy"
        allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowfullscreen></iframe>
    </div>
    <figcaption>${escapeHtml(title)}</figcaption>
  </figure>`;
}

export function activateVideos(root) {
  root.querySelectorAll("iframe[data-src]").forEach((frame) => {
    if (!frame.getAttribute("src")) frame.src = frame.dataset.src;
  });
}

export function silenceVideos(root) {
  root.querySelectorAll("iframe[data-src]").forEach((frame) => {
    frame.removeAttribute("src");
  });
}
