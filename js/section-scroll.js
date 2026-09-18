/**
 * Starrise-style beats: the next section is not on the page until scroll
 * or the down cue asks for it.
 */
export function createBeats({ root, chain, render, onMount }) {
  let mounted = 0;
  let observer = null;

  function mountThrough(id) {
    const index = chain.findIndex((section) => section.id === id);
    const target = index < 0 ? mounted : index + 1;
    while (mounted < target) {
      const section = chain[mounted];
      const el = document.createElement("section");
      el.className = "beat";
      el.id = section.id;
      el.innerHTML = `<div class="beat-inner">${render(section)}</div>`;
      root.appendChild(el);
      mounted += 1;
      onMount?.(el, section);
    }
    placeSentinel();
    return document.getElementById(id);
  }

  function placeSentinel() {
    root.querySelector(".beat-sentinel")?.remove();
    if (mounted >= chain.length) return;
    const sentinel = document.createElement("div");
    sentinel.className = "beat-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    root.appendChild(sentinel);
    observer?.disconnect();
    observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        const next = chain[mounted];
        if (next) mountThrough(next.id);
      }
    }, { rootMargin: "0px" });
    observer.observe(sentinel);
  }

  function detect() {
    const probe = scrollY + Math.min(160, innerHeight * 0.22);
    let current = chain[0]?.id;
    for (const section of chain.slice(0, mounted)) {
      const el = document.getElementById(section.id);
      if (el && el.offsetTop <= probe) current = section.id;
    }
    return current;
  }

  return { mountThrough, detect, get mounted() { return mounted; } };
}

export function initCues({ chain, detect, ensure, scrollToId }) {
  const up = document.getElementById("cue-up");
  const down = document.getElementById("cue-down");
  if (!up || !down) return;

  const paint = () => {
    const id = detect();
    const index = chain.findIndex((section) => section.id === id);
    const prev = index > 0 ? chain[index - 1] : null;
    const next = index >= 0 && index < chain.length - 1 ? chain[index + 1] : null;
    paintCue(up, prev);
    paintCue(down, next);
  };

  const go = async (event) => {
    const cue = event.target.closest?.(".cue");
    if (!cue || cue.hidden) return;
    event.preventDefault();
    const id = cue.getAttribute("href").slice(1);
    await ensure(id);
    scrollToId(id);
    history.replaceState(null, "", `#${id}`);
    paint();
  };

  document.addEventListener("click", go);
  addEventListener("scroll", paint, { passive: true });
  paint();
  return paint;
}

function paintCue(el, section) {
  if (!section) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.href = `#${section.id}`;
  el.textContent = section.label;
  el.setAttribute("aria-label", `Scroll to ${section.label}`);
}

export function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
