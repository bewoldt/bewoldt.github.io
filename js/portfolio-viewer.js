// Image viewer for portfolio cards: big stage image, prev/next buttons and a thumbnail strip.
document.querySelectorAll("[data-viewer]").forEach((viewer) => {
  const stageLink = viewer.querySelector(".viewer-stage");
  let stageImg = stageLink.querySelector("img");
  const count = viewer.querySelector("[data-count]");
  const label = viewer.querySelector("[data-label]");
  const strip = viewer.querySelector(".viewer-thumbs");
  const thumbs = [...strip.querySelectorAll("button")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const FADE_MS = 250; // keep in sync with the opacity transition in main.css
  let current = 0;
  let swap = 0;
  let pending = null;

  // Crossfade: once the new image has loaded, fade it in on top of the current one,
  // then make it the stage image.
  function swapImage(src, alt, animate) {
    const id = ++swap;
    if (pending) pending(); // finish a fade that is still running so the next one starts from its result
    if (!animate || reduceMotion.matches) {
      stageImg.src = src;
      stageImg.alt = alt;
      return;
    }
    const preload = new Image();
    preload.onload = preload.onerror = () => {
      if (id !== swap) return;
      const incoming = document.createElement("img");
      incoming.className = "is-incoming";
      incoming.src = src;
      incoming.alt = alt;
      stageLink.appendChild(incoming);
      incoming.getBoundingClientRect(); // commit opacity: 0 before starting the transition
      incoming.classList.add("is-visible");

      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        pending = null;
        stageImg.remove();
        incoming.classList.remove("is-incoming", "is-visible");
        stageImg = incoming;
      };
      const timer = setTimeout(finish, FADE_MS + 50);
      pending = finish;
    };
    preload.src = src;
  }

  function show(index, animate = true) {
    current = (index + thumbs.length) % thumbs.length;
    const thumb = thumbs[current];
    swapImage(thumb.dataset.src, thumb.dataset.alt, animate);
    stageLink.href = thumb.dataset.full || thumb.dataset.src;
    count.textContent = `${current + 1} / ${thumbs.length}`;
    label.textContent = thumb.dataset.label;
    thumbs.forEach((t, i) =>
      i === current ? t.setAttribute("aria-current", "true") : t.removeAttribute("aria-current")
    );
    // Scroll only the thumbnail strip sideways. scrollIntoView() would also scroll the page.
    const s = strip.getBoundingClientRect();
    const t = thumb.getBoundingClientRect();
    if (t.left < s.left) strip.scrollLeft -= s.left - t.left;
    else if (t.right > s.right) strip.scrollLeft += t.right - s.right;
  }

  thumbs.forEach((thumb, i) => thumb.addEventListener("click", () => show(i)));
  viewer.querySelector("[data-prev]").addEventListener("click", () => show(current - 1));
  viewer.querySelector("[data-next]").addEventListener("click", () => show(current + 1));
  viewer.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") show(current - 1);
    if (e.key === "ArrowRight") show(current + 1);
  });

  if (thumbs.length < 2) {
    viewer.querySelectorAll(".viewer-btn, .viewer-caption, .viewer-thumbs").forEach((el) => (el.hidden = true));
  }

  show(0, false);
});
