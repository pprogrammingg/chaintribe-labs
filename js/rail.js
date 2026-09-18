/** Horizontal rail — drag anywhere on the drawer, not only on the photos. */

export function bindRail(track) {
  const images = track.getElementsByClassName("rail-image");

  track.dataset.mouseDownAt = "0";
  track.dataset.prevPercentage = "0";
  track.dataset.percentage = "0";

  let downX = 0;
  let dragged = false;

  const onDrawer = (node) => {
    const el = node instanceof Element ? node : node?.parentElement;
    return !!(el && track.contains(el));
  };

  const handleOnDown = (e) => {
    downX = e.clientX;
    track.dataset.mouseDownAt = String(e.clientX);
    dragged = false;
  };

  const handleOnUp = () => {
    track.dataset.mouseDownAt = "0";
    track.dataset.prevPercentage = track.dataset.percentage || "0";
  };

  const handleOnMove = (e) => {
    if (track.dataset.mouseDownAt === "0") return;
    if (Math.abs(e.clientX - downX) > 5) dragged = true;

    const mouseDelta = parseFloat(track.dataset.mouseDownAt) - e.clientX;
    const maxDelta = window.innerWidth / 2;
    const percentage = (mouseDelta / maxDelta) * -100;
    const next = Math.max(Math.min(parseFloat(track.dataset.prevPercentage) + percentage, 0), -100);

    track.dataset.percentage = String(next);
    track.animate(
      { transform: `translate(${next}%, -50%)` },
      { duration: 1200, fill: "forwards" }
    );
    for (const image of images) {
      image.animate(
        { objectPosition: `${100 + next}% center` },
        { duration: 1200, fill: "forwards" }
      );
    }
  };

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
}
