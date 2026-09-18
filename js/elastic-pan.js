/** Fixed window. Drag while hovering eases the photo the other way; release returns to center. */

export const REST_SHIFT = -6.9;
export const HOVER_MS = 1200;
export const RELEASE_MS = 1100;
export const RELEASE_EASING = "cubic-bezier(0.22, 1.45, 0.36, 1)";

/**
 * Dragging left moves the photo left, so the window shows more of its right side.
 * Returns a translateX percentage. Rest is slightly inset, so both edges stay cropped.
 */
export function dragToShift(clientX, originX, width) {
  if (!width) return REST_SHIFT;
  const shift = Math.min(1, Math.max(-1, (clientX - originX) / width));
  return REST_SHIFT + shift * 5.5;
}

export function shiftTransform(shift) {
  return `translateX(${shift.toFixed(2)}%)`;
}

function chase(img, transform, release) {
  const from = getComputedStyle(img).transform;
  img.getAnimations().forEach((anim) => anim.cancel());
  img.animate(
    [{ transform: from && from !== "none" ? from : shiftTransform(REST_SHIFT) }, { transform }],
    {
      duration: release ? RELEASE_MS : HOVER_MS,
      easing: release ? RELEASE_EASING : "ease",
      fill: "forwards",
    }
  );
}

export function bindElasticPan(frame) {
  const img = frame.querySelector("img");
  if (!img || frame.dataset.panBound === "1") return () => {};
  frame.dataset.panBound = "1";
  img.draggable = false;
  img.setAttribute("draggable", "false");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return () => {};

  let dragging = false;
  let moved = false;
  let originX = 0;
  img.style.transform = shiftTransform(REST_SHIFT);
  frame.dataset.pan = String(REST_SHIFT);

  const move = (event) => {
    if (!dragging || event.buttons === 0) return;
    if (Math.abs(event.clientX - originX) > 8) moved = true;
    const next = dragToShift(event.clientX, originX, frame.getBoundingClientRect().width);
    frame.dataset.pan = String(next);
    chase(img, shiftTransform(next), false);
  };

  const settle = () => {
    if (!dragging && frame.dataset.pan === String(REST_SHIFT)) return;
    dragging = false;
    frame.dataset.pan = String(REST_SHIFT);
    chase(img, shiftTransform(REST_SHIFT), true);
  };

  frame.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.pointerType === "touch") return;
    dragging = true;
    moved = false;
    originX = event.clientX;
    event.preventDefault();
  });
  frame.addEventListener("pointermove", move);
  frame.addEventListener("pointerup", (event) => {
    const wasDrag = moved;
    settle();
    if (wasDrag) return;
    const link = frame.closest("a[href]");
    if (!link) return;
    event.preventDefault();
    location.assign(link.href);
  });
  frame.addEventListener("pointercancel", settle);
  frame.addEventListener("pointerleave", settle);
  frame.addEventListener("dragstart", (event) => event.preventDefault());
  return () => {};
}

function windowFor(img) {
  const existing = img.closest(".pan-frame, .pan-window");
  if (existing) return existing;
  const frame = document.createElement("span");
  frame.className = "pan-window";
  img.parentNode.insertBefore(frame, img);
  frame.appendChild(img);
  return frame;
}

export function bindImageWindows(root = document) {
  const bind = (img) => {
    if (!(img instanceof Element) || img.dataset.panSkip === "1") return;
    bindElasticPan(windowFor(img));
  };
  root.querySelectorAll("img").forEach(bind);
  document.addEventListener("dragstart", (event) => {
    if (event.target instanceof Element && event.target.closest("img, .pan-frame, .pan-window")) {
      event.preventDefault();
    }
  }, true);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches("img")) bind(node);
        node.querySelectorAll?.("img").forEach(bind);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
