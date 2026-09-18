import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ARTICLE_BATCH,
  TOC_PAGE,
  extendForward,
  fillEarlierGaps,
  neighborWindow,
  pageSlice,
} from "../js/progressive.js";
import { REST_SHIFT, dragToShift } from "../js/elastic-pan.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "dev/output");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const fails = [];

function assert(ok, message) {
  if (!ok) fails.push(message);
}

function unit() {
  const items = ["a", "b", "c", "d", "e", "f", "g"].map((id) => ({ id }));
  const first = pageSlice(items, 0, TOC_PAGE);
  assert(first.slice.length === 5 && first.nextPage === 1, "TOC first page is five titles");
  assert(pageSlice(items, 1, TOC_PAGE).slice.map((item) => item.id).join() === "f,g", "TOC second page is the remainder");
  assert(pageSlice(items, 2, TOC_PAGE).slice.length === 0, "TOC stops after the last page");

  const loaded = new Set(["a", "b"]);
  assert(extendForward(items, loaded, ARTICLE_BATCH).map((item) => item.id).join() === "c,d", "scroll appends the next batch");
  assert(neighborWindow(items, "f").map((item) => item.id).join() === "e,f,g", "a contents click loads neighbors");
  const jumped = new Set(["a", "b", "e", "f", "g"]);
  assert(fillEarlierGaps(items, jumped, ARTICLE_BATCH).map((item) => item.id).join() === "c,d", "scrolling up fills the hole");

  assert(dragToShift(80, 200, 200) < REST_SHIFT, "dragging left moves the photo left, revealing its right side");
  assert(dragToShift(320, 200, 200) > REST_SHIFT, "dragging right moves the photo right, revealing its left side");
  assert(dragToShift(200, 200, 200) === REST_SHIFT, "no drag stays centered, with both edges cropped");
}

function files() {
  const posts = JSON.parse(fs.readFileSync(path.join(ROOT, "data/posts.json"), "utf8"));
  const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data/site.json"), "utf8"));
  for (const post of posts.posts) {
    const file = path.join(ROOT, "data/posts", `${post.file || post.id}.html`);
    assert(fs.existsSync(file), `missing essay body ${post.id}`);
    const text = fs.readFileSync(file, "utf8");
    assert(!/recrods|Dybnamo|hapened|farmework|sofware/.test(text), `typos left in ${post.id}`);
  }
  for (const item of site.nav) {
    assert(fs.existsSync(path.join(ROOT, item.href)), `nav target missing: ${item.href}`);
  }
    assert(site.nav.at(-1).id === "contact", "contact is the last nav item");
    const projectEssays = ["radix-dex", "ledger-loyalty", "northern-labs-payments"];
    for (const file of projectEssays) {
      const body = fs.readFileSync(path.join(ROOT, "data/posts", `${file}.html`), "utf8");
      assert((body.match(/<p\b/g) || []).length === 2, `${file} stays at two paragraphs`);
    }
  assert(!fs.existsSync(path.join(ROOT, "about.html")), "about.html should not remain; profile is the landing page");
  const css = fs.readFileSync(path.join(ROOT, "css/tokens.css"), "utf8");
  assert(!/overflow:\s*hidden/.test(css), "body scroll must not be trapped");
}

function mime(file) {
  const ext = path.extname(file);
  return {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
  }[ext] || "application/octet-stream";
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://127.0.0.1");
      const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
      const file = path.join(ROOT, path.normalize(rel));
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        res.end("missing");
        return;
      }
      res.writeHead(200, { "content-type": mime(file) });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function startChrome() {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(OUT, { recursive: true });
    const profile = path.join(OUT, "chrome-profile");
    const chrome = spawn(CHROME, [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
    ], { stdio: ["ignore", "pipe", "pipe"] });
    let buf = "";
    const timer = setTimeout(() => reject(new Error("Chrome did not open a debugging port")), 15000);
    const onData = (chunk) => {
      buf += chunk.toString();
      const match = buf.match(/127\.0\.0\.1:(\d+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve({ chrome, port: Number(match[1]) });
    };
    chrome.stderr.on("data", onData);
    chrome.stdout.on("data", onData);
    chrome.on("error", reject);
  });
}

async function openPage(debugPort, url) {
  const created = await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
  const page = await created.json();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("devtools socket failed")));
  });
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const next = ++id;
    pending.set(next, { resolve, reject });
    ws.send(JSON.stringify({ id: next, method, params }));
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.reload", { ignoreCache: true });
  return {
    ws,
    send,
    close: () => ws.close(),
  };
}

async function evalValue(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "page exception");
  }
  return result.result.value;
}

async function waitFor(page, expression, label) {
  const started = Date.now();
  let last = null;
  while (Date.now() - started < 8000) {
    last = await evalValue(page, `JSON.stringify((() => { try { return { ok: !!(${expression}), href: location.href, hash: location.hash }; } catch (e) { return { error: String(e) }; } })())`);
    const parsed = JSON.parse(last);
    if (parsed.ok) return;
    await new Promise((r) => setTimeout(r, 80));
  }
  throw new Error(`timed out waiting for ${label}: ${last}`);
}

async function shot(page, name) {
  const { data } = await page.send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(OUT, name), Buffer.from(data, "base64"));
}

async function browser(origin, debugPort) {
  const profile = await openPage(debugPort, `${origin}/index.html?check=1`);
  try {
    await waitFor(profile, "document.body.classList.contains('is-ready') && document.querySelectorAll('.rail-card').length === 3", "profile rail");
    assert(await evalValue(profile, "!!document.querySelector('.rail-drawer .rail-handle')") === true, "rail drawer has a left handle");
    await shot(profile, "profile-before-drag.png");
    assert(await evalValue(profile, "!document.body.innerText.includes('I design systems') && !document.getElementById('writing')") === true, "profile intro and writing are gone");
    assert(await evalValue(profile, "getComputedStyle(document.body).overflow === 'hidden'") === true, "profile does not scroll vertically");
    const box = JSON.parse(await evalValue(profile, `(() => {
      const handle = document.querySelector('.rail-handle').getBoundingClientRect();
      const pad = document.getElementById('image-track').getBoundingClientRect();
      return JSON.stringify({
        handle: { x: handle.left + handle.width / 2, y: handle.top + handle.height / 2 },
        pad: { x: pad.left + 24, y: pad.top + 20 }
      });
    })()`));
    await profile.send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.handle.x, y: box.handle.y, button: "left", clickCount: 1 });
    await profile.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.handle.x - 360, y: box.handle.y, button: "left", buttons: 1 });
    await profile.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: box.handle.x - 520, y: box.handle.y, button: "left", buttons: 1 });
    const during = JSON.parse(await evalValue(profile, `(() => {
      const track = document.getElementById('image-track');
      return JSON.stringify({ dragged: track.dataset.percentage });
    })()`));
    assert(Number.parseFloat(during.dragged) < 0, `dragging the drawer handle should pan the rail, got ${during.dragged}`);
    await profile.send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.handle.x - 520, y: box.handle.y, button: "left", clickCount: 1 });
    await new Promise((r) => setTimeout(r, 1300));
    const pan = JSON.parse(await evalValue(profile, `(() => {
      const track = document.getElementById('image-track');
      const labels = [...document.querySelectorAll('.rail-label')].map((el) => el.textContent);
      const first = document.querySelector('.rail-card').getBoundingClientRect();
      const handle = document.querySelector('.rail-handle').getBoundingClientRect();
      return JSON.stringify({
        dragged: track.dataset.percentage,
        transform: getComputedStyle(track).transform,
        labels,
        href: document.querySelector('.rail-card').getAttribute('data-href'),
        cardLeft: first.left,
        handleLeft: handle.left
      });
    })()`));
    assert(pan.handleLeft < 200, `drawer handle should slide in from the left after drag, left=${pan.handleLeft}`);
    assert(pan.labels.join("|") === "Decentralized Exchange|Loyalty|More Experience", `short card labels, got ${pan.labels.join("|")}`);
    assert(pan.href === "blog.html#dex", "clicking a card opens its blog essay");
    await shot(profile, "profile-after-drag.png");
    await shot(profile, "profile.png");
    await shot(profile, "work.png");
  } finally {
    profile.close();
  }

  const blog = await openPage(debugPort, `${origin}/blog.html?check=1`);
  try {
    await waitFor(blog, "window.__site && window.__site.loaded().length === 2", "first essay batch");
    assert(await evalValue(blog, "window.__site.tocCount()") === 5, "contents starts with the first five titles");
    await shot(blog, "blog.png");
    await evalValue(blog, "document.querySelector('#toc-list a[data-post=\"heavy-processing-api-gw-ddb-part2\"]').click()");
    await waitFor(blog, "window.__site.loaded().includes('dex')", "contents click loads neighbors");
    assert(await evalValue(blog, "document.querySelectorAll('#dex .post-body p').length === 2 && document.querySelectorAll('#dex .videos iframe').length === 3") === true, "project essay is two paragraphs plus its videos");
    await evalValue(blog, "document.getElementById('toc-toggle').click()");
    assert(await evalValue(blog, "document.getElementById('toc-panel').hidden") === true, "contents can minimize");
  } finally {
    blog.close();
  }

  const deep = await openPage(debugPort, "about:blank");
  try {
    await deep.send("Page.navigate", { url: `${origin}/blog.html?check=1#dex` });
    await waitFor(deep, "location.hash === '#dex' && !!document.getElementById('dex')", "dex essay loaded from the profile link");
  } finally {
    deep.close();
  }

  const contact = await openPage(debugPort, `${origin}/contact.html?check=1`);
  try {
    await waitFor(contact, "document.body.classList.contains('is-ready') && document.getElementById('reach')", "contact");
    assert(await evalValue(contact, "document.body.innerText.includes('pprogrammingg@gmail.com')") === true, "email is on the contact page");
    assert(await evalValue(contact, "!document.body.innerText.includes('Write when the problem is real')") === true, "contact intro copy is gone");
    await evalValue(contact, "document.getElementById('cue-down').click()");
    await waitFor(contact, "!!document.getElementById('collaborate')", "contact second beat");
    await shot(contact, "contact.png");
  } finally {
    contact.close();
  }
}

unit();
files();
if (fails.length) {
  console.error(fails.join("\n"));
  process.exit(1);
}

if (!fs.existsSync(CHROME)) {
  console.log("unit and file checks passed; Chrome not available for page checks");
  process.exit(0);
}

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
let chrome;
try {
  const started = await startChrome();
  chrome = started.chrome;
  await browser(origin, started.port);
} catch (error) {
  fails.push(error.stack || error.message);
} finally {
  chrome?.kill();
  server.close();
}

if (fails.length) {
  console.error(fails.join("\n"));
  process.exit(1);
}
console.log("pages checked");
