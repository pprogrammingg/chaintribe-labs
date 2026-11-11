/** Horizontal rail — drag the drawer; photos translate inside each frame. */

/** Image is 140% wide. At rest show the right side (like object-position: 100%). */
const IMAGE_WIDTH = 1.4;
const MAX_SHIFT = (1 - 1 / IMAGE_WIDTH) * 100;
const IDLE_HINT_MS = 3000;

export function panTransform(nextPercentage) {
  const x = ((100 + nextPercentage) / 100) * -MAX_SHIFT;
  return `translateX(${x.toFixed(3)}%)`;
}

export function bindRail(track, stage = track.parentElement) {
  const images = [...track.getElementsByClassName("rail-image")];
  const hintTarget = stage || track;

  track.dataset.mouseDownAt = "0";
  track.dataset.prevPercentage = "0";
  track.dataset.percentage = "0";

  let downX = 0;
  let dragged = false;
  let hovered = false;
  let idleTimer = 0;
  let bobAnim = null;

  const prefersReducedMotion = () =>
    matchMedia("(prefers-reduced-motion: reduce)").matches;

  const stopBob = () => {
    bobAnim?.cancel();
    bobAnim = null;
    if (stage) hintTarget.style.transform = "translateY(-50%)";
    hintTarget.classList.remove("is-idle-hint");
  };

  const startBob = () => {
    if (!hintTarget || prefersReducedMotion() || hovered || bobAnim) return;
    hintTarget.classList.add("is-idle-hint");
    bobAnim = hintTarget.animate(
      [
        { transform: "translateY(-50%) translateX(0px)" },
        { transform: "translateY(-50%) translateX(-1.25rem)" },
        { transform: "translateY(-50%) translateX(1.25rem)" },
        { transform: "translateY(-50%) translateX(0px)" },
      ],
      {
        duration: 2400,
        iterations: Infinity,
        easing: "ease-in-out",
      }
    );
  };

  const stopIdleHint = () => {
    clearTimeout(idleTimer);
    idleTimer = 0;
    stopBob();
  };

  const scheduleIdleHint = () => {
    stopIdleHint();
    if (prefersReducedMotion() || hovered || track.dataset.mouseDownAt !== "0") return;
    idleTimer = window.setTimeout(() => {
      if (!hovered && track.dataset.mouseDownAt === "0") startBob();
    }, IDLE_HINT_MS);
  };

  const onDrawer = (node) => {
    const el = node instanceof Element ? node : node?.parentElement;
    return !!(el && track.contains(el));
  };

  const apply = (next) => {
    track.dataset.percentage = String(next);
    track.animate(
      { transform: `translate(${next}%, 0)` },
      { duration: 1200, fill: "forwards" }
    );
    const pan = panTransform(next);
    for (const image of images) {
      image.animate({ transform: pan }, { duration: 1200, fill: "forwards" });
    }
  };

  const handleOnDown = (e) => {
    stopIdleHint();
    downX = e.clientX;
    track.dataset.mouseDownAt = String(e.clientX);
    dragged = false;
  };

  const handleOnUp = () => {
    track.dataset.mouseDownAt = "0";
    track.dataset.prevPercentage = track.dataset.percentage || "0";
    if (!hovered) scheduleIdleHint();
  };

  const handleOnMove = (e) => {
    if (track.dataset.mouseDownAt === "0") return;
    if (Math.abs(e.clientX - downX) > 5) dragged = true;

    const mouseDelta = parseFloat(track.dataset.mouseDownAt) - e.clientX;
    const maxDelta = window.innerWidth / 2;
    const percentage = (mouseDelta / maxDelta) * -100;
    const next = Math.max(Math.min(parseFloat(track.dataset.prevPercentage) + percentage, 0), -100);
    apply(next);
  };

  for (const image of images) {
    image.style.transform = panTransform(0);
  }

  const markHover = () => {
    hovered = true;
    stopIdleHint();
  };

  const markLeave = () => {
    hovered = false;
    if (track.dataset.mouseDownAt === "0") scheduleIdleHint();
  };

  // Hover on the drawer itself stops the bob immediately.
  for (const el of [hintTarget, track]) {
    el.addEventListener("pointerenter", markHover);
    el.addEventListener("pointerleave", markLeave);
    el.addEventListener("mouseenter", markHover);
    el.addEventListener("mouseleave", markLeave);
  }

  window.onmousedown = (e) => {
    if (!onDrawer(e.target)) return;
    handleOnDown(e);
  };
  window.ontouchstart = (e) => {
    if (!onDrawer(e.target)) return;
    handleOnDown(e.touches[0]);
  };
  window.onmouseup = () => handleOnUp();
  window.ontouchend = () => handleOnUp();
  window.onmousemove = (e) => handleOnMove(e);
  window.ontouchmove = (e) => handleOnMove(e.touches[0]);

  track.querySelectorAll(".rail-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      if (dragged) {
        event.preventDefault();
        event.stopPropagation();
        dragged = false;
        return;
      }
      const href = card.dataset.href;
      if (href) location.assign(href);
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      const href = card.dataset.href;
      if (href) location.assign(href);
    });
  });

  window.addEventListener("dragstart", (event) => {
    if (onDrawer(event.target)) event.preventDefault();
  });

  scheduleIdleHint();
}
