import { mountChrome, markReady } from "./chrome.js";
import { escapeHtml, fetchJson } from "./html.js";
import { videoFrame } from "./media.js";
import {
  ARTICLE_BATCH,
  TOC_PAGE,
  extendForward,
  fillEarlierGaps,
  neighborWindow,
  pageSlice,
} from "./progressive.js";

const catalog = await fetchJson("data/posts.json");
const posts = catalog.posts;
await mountChrome();

const column = document.getElementById("posts");
const loaded = new Set();
let tocPage = 0;
let tocDone = false;

const toc = document.getElementById("toc");
const tocList = document.getElementById("toc-list");
const tocCount = document.getElementById("toc-count");
const tocMore = document.getElementById("toc-more");
const tocToggle = document.getElementById("toc-toggle");
const narrow = matchMedia("(max-width: 980px)").matches;
setTocOpen(!narrow);

tocToggle.addEventListener("click", () => setTocOpen(toc.dataset.open !== "true"));

appendTocPage();
watchToc();
let loading = false;

const hash = location.hash.replace(/^#/, "");
if (posts.some((post) => post.id === hash)) {
  await openPost(hash, { scroll: true });
  addEventListener("load", () => scrollToPost(hash));
  setTimeout(() => scrollToPost(hash), 0);
} else {
  await ensurePosts(posts.slice(0, ARTICLE_BATCH));
}

watchColumn();
bindCues();
document.addEventListener("click", onClick);
markReady();

if (location.search.includes("check=1")) {
  window.__site = {
    loaded: () => [...loaded],
    tocCount: () => tocList.querySelectorAll("a").length,
    tocOpen: () => toc.dataset.open === "true",
  };
}

function setTocOpen(open) {
  toc.dataset.open = open ? "true" : "false";
  document.getElementById("toc-panel").hidden = !open;
  tocToggle.setAttribute("aria-expanded", open ? "true" : "false");
  tocToggle.textContent = open ? "Minimize" : "Contents";
}

function appendTocPage() {
  if (tocDone) return;
  const { slice, nextPage } = pageSlice(posts, tocPage, TOC_PAGE);
  if (!slice.length) {
    tocDone = true;
    return;
  }
  tocPage += 1;
  tocDone = nextPage == null;
  const html = slice.map((post) => `
    <li>
      <a href="#${escapeHtml(post.id)}" data-post="${escapeHtml(post.id)}">${escapeHtml(post.title)}</a>
    </li>
  `).join("");
  tocList.querySelector(".toc-sentinel")?.remove();
  tocList.insertAdjacentHTML("beforeend", html);
  const shown = tocList.querySelectorAll("a").length;
  tocCount.textContent = `${shown} of ${posts.length}`;
  tocMore.hidden = tocDone;
  if (!tocDone) {
    const sentinel = document.createElement("li");
    sentinel.className = "toc-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.textContent = "";
    tocList.appendChild(sentinel);
  }
}

function watchToc() {
  let scrolled = false;
  tocList.addEventListener("scroll", () => {
    scrolled = true;
    const sentinel = tocList.querySelector(".toc-sentinel");
    if (!sentinel || !scrolled) return;
    const box = tocList.getBoundingClientRect();
    const mark = sentinel.getBoundingClientRect();
    if (mark.top <= box.bottom + 8) appendTocPage();
  }, { passive: true });
}

async function ensurePosts(list) {
  const missing = list.filter((post) => post && !loaded.has(post.id));
  if (!missing.length) return [];
  const bodies = await Promise.all(missing.map((post) => fetch(`data/posts/${post.file || post.id}.html`).then((res) => {
    if (!res.ok) throw new Error(`Missing essay ${post.id}`);
    return res.text();
  })));
  missing.forEach((post, index) => {
    if (loaded.has(post.id)) return;
    placeArticle(renderPost(post, bodies[index]));
    loaded.add(post.id);
  });
  paintGaps();
  paintCurrent();
  return missing.map((post) => post.id);
}

function renderPost(post, body) {
  const article = document.createElement("article");
  article.className = "post";
  article.id = post.id;
  article.dataset.index = String(posts.findIndex((item) => item.id === post.id));
  const tags = (post.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
  const videos = (post.videos || []).map((video) => videoFrame(video)).join("");
  const when = post.date
    ? `<time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date))}</time>`
    : "";
  const lede = post.summary ? `<p class="post-lede">${escapeHtml(post.summary)}</p>` : "";
  article.innerHTML = `
    <p class="post-kicker">
      ${when}
      ${post.minutes ? `<span>${escapeHtml(String(post.minutes))} min</span>` : ""}
      ${tags}
    </p>
    <h2 class="post-title">${escapeHtml(post.title)}</h2>
    ${lede}
    <figure class="post-figure">
      <img src="${escapeHtml(post.image)}" alt="${escapeHtml(post.imageAlt)}" loading="lazy">
    </figure>
    <div class="post-body">${body}</div>
    ${videos ? `<div class="videos">${videos}</div>` : ""}
  `;
  return article;
}

function placeArticle(article) {
  const index = Number(article.dataset.index);
  const before = [...column.querySelectorAll("article.post")].find((el) => Number(el.dataset.index) > index);
  column.insertBefore(article, before || column.querySelector(".end-note"));
}

function paintGaps() {
  column.querySelector(".gap-note")?.remove();
  const earlier = fillEarlierGaps(posts, loaded, 1);
  if (!earlier.length) return;
  const note = document.createElement("p");
  note.className = "gap-note";
  note.textContent = "Earlier notes load as you scroll up.";
  column.prepend(note);
}

async function loadForward() {
  if (loading) return [];
  const next = extendForward(posts, loaded, ARTICLE_BATCH);
  if (!next.length) return [];
  loading = true;
  try {
    return await ensurePosts(next);
  } finally {
    loading = false;
    paintBlogCue();
  }
}

async function loadEarlier() {
  if (loading) return [];
  const earlier = fillEarlierGaps(posts, loaded, ARTICLE_BATCH);
  if (!earlier.length) return [];
  loading = true;
  try {
    return await ensurePosts(earlier);
  } finally {
    loading = false;
  }
}

function watchColumn() {
  const end = document.createElement("p");
  end.className = "end-note";
  end.textContent = "More notes load as you reach the end.";
  column.appendChild(end);
  addEventListener("scroll", () => {
    paintCurrent();
    const nearBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 160;
    if (nearBottom && scrollY > 40) loadForward();
    if (scrollY < 48) loadEarlier();
  }, { passive: true });
}

function bindCues() {
  const down = document.getElementById("cue-down");
  const up = document.getElementById("cue-up");
  down.addEventListener("click", async (event) => {
    event.preventDefault();
    const ids = await loadForward();
    if (ids[0]) document.getElementById(ids[0])?.scrollIntoView({ behavior: "smooth", block: "start" });
    paintBlogCue();
  });
  up.addEventListener("click", (event) => {
    event.preventDefault();
    scrollTo({ top: 0, behavior: "smooth" });
  });
  paintBlogCue();
  addEventListener("scroll", () => {
    up.hidden = scrollY < 240;
    if (!up.hidden) {
      up.textContent = "Top";
      up.href = "#posts";
    }
  }, { passive: true });
}

function paintBlogCue() {
  const down = document.getElementById("cue-down");
  const more = extendForward(posts, loaded, 1).length > 0;
  down.hidden = !more;
  if (more) {
    down.textContent = "More";
    down.href = "#posts";
    down.setAttribute("aria-label", "Load more notes");
  }
}

function scrollToPost(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const header = document.querySelector(".site-header")?.offsetHeight || 68;
  const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - header - 16);
  document.documentElement.scrollTop = y;
  document.body.scrollTop = y;
  window.scrollTo({ top: y, behavior: location.search.includes("check=1") ? "auto" : "smooth" });
  el.tabIndex = -1;
  el.focus({ preventScroll: false });
}

async function openPost(id, { scroll }) {
  const windowed = neighborWindow(posts, id);
  await ensurePosts(windowed);
  const index = posts.findIndex((post) => post.id === id);
  while (tocList.querySelectorAll("a").length <= index && !tocDone) appendTocPage();
  if (scroll) scrollToPost(id);
  history.replaceState(null, "", `#${id}`);
  paintBlogCue();
  markCurrent(id);
}

function onClick(event) {
  const link = event.target.closest("a[href]");
  if (!link) return;
  const url = new URL(link.href, location.href);
  const id = decodeURIComponent(url.hash.replace(/^#/, ""));
  const onBlog = url.pathname.endsWith("blog.html") || url.pathname === location.pathname;
  if (!onBlog || !posts.some((post) => post.id === id)) return;
  event.preventDefault();
  openPost(id, { scroll: true });
}

function paintCurrent() {
  const probe = scrollY + Math.min(180, innerHeight * 0.28);
  let current = null;
  for (const article of column.querySelectorAll("article.post")) {
    if (article.offsetTop <= probe) current = article.id;
  }
  markCurrent(current);
}

function markCurrent(id) {
  column.querySelectorAll("article.post").forEach((article) => {
    article.classList.toggle("is-current", article.id === id);
  });
  tocList.querySelectorAll("a").forEach((link) => {
    const on = link.dataset.post === id;
    link.classList.toggle("is-current", on);
    if (on) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
}

function formatDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
