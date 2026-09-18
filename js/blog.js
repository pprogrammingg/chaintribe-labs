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
const employersCatalog = await fetchJson("data/employers.json");
const posts = catalog.posts;
await mountChrome();

const column = document.getElementById("posts");
const loaded = new Set();
let tocPage = 0;
let tocDone = false;
let drawer = null;

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
  await openPost(hash, { scroll: true, exact: true });
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
  tocMore.hidden = tocDone;
  if (!tocDone) {
    const sentinel = document.createElement("li");
    sentinel.className = "toc-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    sentinel.textContent = "";
    tocList.appendChild(sentinel);
  }
  paintTocCount();
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
  const employers = (post.employers || []).map((id) => {
    const employer = employersCatalog[id];
    if (!employer) return "";
    return `
    <li>
      <button type="button" class="employer" data-employer="${escapeHtml(id)}" aria-haspopup="dialog">
        ${employer.logo
          ? `<img class="employer-logo" src="${escapeHtml(employer.logo)}" alt="" width="18" height="18" loading="lazy">`
          : `<span class="employer-mark" aria-hidden="true">${escapeHtml(employer.name.charAt(0))}</span>`}
        <span class="employer-name">${escapeHtml(employer.name)}</span>
      </button>
    </li>`;
  }).join("");
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
    ${employers ? `<ul class="employer-list">${employers}</ul>` : ""}
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
  let lastY = window.scrollY;
  addEventListener("scroll", () => {
    paintCurrent();
    const y = window.scrollY;
    const nearBottom = innerHeight + y >= document.documentElement.scrollHeight - 160;
    if (nearBottom && y > 40) loadForward();
    // Only fill earlier notes when the reader scrolls up into the top, not on deep-link settle.
    if (y < 48 && lastY > 120) loadEarlier();
    lastY = y;
  }, { passive: true });
}

function bindCues() {
  const down = document.getElementById("cue-down");
  const up = document.getElementById("cue-up");
  down.addEventListener("click", async (event) => {
    event.preventDefault();
    const index = currentPostIndex();
    if (index >= 0 && index < posts.length - 1) {
      await openPost(posts[index + 1].id, { scroll: true });
      return;
    }
    const ids = await loadForward();
    if (ids[0]) document.getElementById(ids[0])?.scrollIntoView({ behavior: "smooth", block: "start" });
    paintBlogCue();
  });
  up.addEventListener("click", async (event) => {
    event.preventDefault();
    const index = currentPostIndex();
    if (index > 0) {
      await openPost(posts[index - 1].id, { scroll: true });
      return;
    }
    scrollTo({ top: 0, behavior: "smooth" });
    paintBlogCue();
  });
  paintBlogCue();
  addEventListener("scroll", paintBlogCue, { passive: true });
}

function currentPostIndex() {
  const probe = scrollY + Math.min(180, innerHeight * 0.28);
  let id = null;
  for (const article of column.querySelectorAll("article.post")) {
    if (article.offsetTop <= probe) id = article.id;
  }
  return posts.findIndex((post) => post.id === id);
}

function paintBlogCue() {
  const down = document.getElementById("cue-down");
  const up = document.getElementById("cue-up");
  const index = currentPostIndex();
  const nearTop = scrollY < 64;
  const nearBottom = innerHeight + scrollY >= document.documentElement.scrollHeight - 96;
  const hasPrev = index > 0 || scrollY > 64;
  const hasNext = index < posts.length - 1 || extendForward(posts, loaded, 1).length > 0;

  // Keep both cues mid-page; only drop the one that cannot apply at an end.
  up.hidden = nearTop && !hasPrev;
  down.hidden = nearBottom && !hasNext;

  up.textContent = "Previous";
  up.href = "#posts";
  up.setAttribute("aria-label", "Previous note");

  down.textContent = "Next";
  down.href = "#posts";
  down.setAttribute("aria-label", "Next note");
}

function scrollToPost(id) {
  const el = document.getElementById(id);
  if (!el) return;
  column.querySelectorAll(".post.is-current").forEach((node) => node.classList.remove("is-current"));
  el.classList.add("is-current");
  const header = document.querySelector(".site-header")?.offsetHeight || 68;
  const place = () => {
    const y = Math.max(0, el.getBoundingClientRect().top + window.scrollY - header - 16);
    document.documentElement.scrollTop = y;
    document.body.scrollTop = y;
    window.scrollTo({ top: y, behavior: "auto" });
  };
  place();
  el.tabIndex = -1;
  el.focus({ preventScroll: true });
  requestAnimationFrame(place);
  setTimeout(place, 120);
  setTimeout(place, 400);
  el.querySelectorAll("img").forEach((img) => {
    if (!img.complete) img.addEventListener("load", place, { once: true });
  });
}

async function openPost(id, { scroll, exact = false }) {
  const target = posts.find((post) => post.id === id);
  if (!target) return;
  const windowed = exact ? [target] : neighborWindow(posts, id);
  await ensurePosts(windowed);
  const index = posts.findIndex((post) => post.id === id);
  while (tocList.querySelectorAll("a").length <= index && !tocDone) appendTocPage();
  if (scroll) {
    scrollToPost(id);
    if (exact) {
      requestAnimationFrame(() => scrollToPost(id));
      setTimeout(() => scrollToPost(id), 50);
    }
  }
  history.replaceState(null, "", `#${id}`);
  paintBlogCue();
  markCurrent(id);
}

function onClick(event) {
  const employerBtn = event.target.closest("[data-employer]");
  if (employerBtn) {
    event.preventDefault();
    openEmployerDrawer(employerBtn.dataset.employer);
    return;
  }
  const link = event.target.closest("a[href]");
  if (!link) return;
  const url = new URL(link.href, location.href);
  const id = decodeURIComponent(url.hash.replace(/^#/, ""));
  const onBlog = url.pathname.endsWith("blog.html") || url.pathname === location.pathname;
  if (!onBlog || !posts.some((post) => post.id === id)) return;
  event.preventDefault();
  openPost(id, { scroll: true });
}

function ensureDrawer() {
  if (drawer) return drawer;
  document.body.insertAdjacentHTML("beforeend", `
    <div class="employer-drawer" id="employer-drawer" hidden>
      <button type="button" class="employer-drawer__backdrop" data-drawer-close aria-label="Close"></button>
      <aside class="employer-drawer__panel" role="dialog" aria-modal="true" aria-labelledby="employer-drawer-title" tabindex="-1">
        <header class="employer-drawer__head">
          <button type="button" class="employer-drawer__close" data-drawer-close aria-label="Close">Close</button>
        </header>
        <div class="employer-drawer__body" id="employer-drawer-body"></div>
      </aside>
    </div>
  `);
  drawer = document.getElementById("employer-drawer");
  drawer.addEventListener("click", (event) => {
    if (event.target.closest("[data-drawer-close]")) closeEmployerDrawer();
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !drawer.hidden) closeEmployerDrawer();
  });
  return drawer;
}

function openEmployerDrawer(id) {
  const employer = employersCatalog[id];
  if (!employer) return;
  const shell = ensureDrawer();
  const highlights = (employer.highlights || [])
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");
  document.getElementById("employer-drawer-body").innerHTML = `
    <div class="employer-drawer__brand">
      ${employer.logo
        ? `<img src="${escapeHtml(employer.logo)}" alt="" width="24" height="24">`
        : ""}
      <div>
        <p class="employer-drawer__role">${escapeHtml(employer.role || "Engagement")}</p>
        <h3 id="employer-drawer-title">${escapeHtml(employer.name)}</h3>
      </div>
    </div>
    ${employer.lede ? `<p class="employer-drawer__lede">${escapeHtml(employer.lede)}</p>` : ""}
    ${highlights ? `<ul class="employer-drawer__list">${highlights}</ul>` : ""}
    ${employer.href
      ? `<p class="employer-drawer__site"><a href="${escapeHtml(employer.href)}" target="_blank" rel="noopener noreferrer">Company site</a></p>`
      : ""}
  `;
  shell.hidden = false;
  document.body.classList.add("drawer-open");
  shell.querySelector(".employer-drawer__panel")?.focus();
}

function closeEmployerDrawer() {
  if (!drawer || drawer.hidden) return;
  drawer.hidden = true;
  document.body.classList.remove("drawer-open");
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
    if (on) {
      link.setAttribute("aria-current", "true");
      link.scrollIntoView({ block: "nearest", inline: "nearest" });
    } else {
      link.removeAttribute("aria-current");
    }
  });
  paintTocCount(id);
}

function paintTocCount(id = column.querySelector("article.post.is-current")?.id) {
  const index = posts.findIndex((post) => post.id === id);
  const place = index >= 0 ? index + 1 : Math.min(1, posts.length);
  tocCount.textContent = `${place} of ${posts.length}`;
}

function formatDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
