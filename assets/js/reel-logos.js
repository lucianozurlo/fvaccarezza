(() => {
  const mq = window.matchMedia("(max-width: 767px)");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const speed = 70; // px/seg (ajustá a gusto)

  document.querySelectorAll(".trusted-container").forEach((container) => {
    const track = container.querySelector(".trusted-track");
    if (!track) return;

    if (container.dataset.reelInit === "1") return;
    container.dataset.reelInit = "1";

    let raf = null;
    let last = 0;
    let x = 0;
    let distance = 0;
    const originals = Array.from(track.children);
    const originalCount = originals.length;

    function ensureClones() {
      if (track.querySelector("[data-reel-clone='1']")) return;

      originals.forEach((node, i) => {
        const copy = node.cloneNode(true);
        copy.setAttribute("data-reel-clone", "1");
        if (i === 0) copy.setAttribute("data-reel-first-clone", "1");
        track.appendChild(copy);
      });
    }

    function removeClones() {
      track
        .querySelectorAll("[data-reel-clone='1']")
        .forEach((n) => n.remove());
    }

    function measureDistance() {
      const first = track.children[0];
      const firstClone =
        track.querySelector("[data-reel-first-clone='1']") ||
        track.children[originalCount];

      if (!first || !firstClone) return 0;

      // OJO: esto incluye gaps y anchos reales, y NO depende de que los logos sean iguales
      const a = first.getBoundingClientRect().left;
      const b = firstClone.getBoundingClientRect().left;
      const d = b - a;

      return d > 0 ? d : 0;
    }

    function stop() {
      if (raf) cancelAnimationFrame(raf);
      raf = null;
      last = 0;
    }

    function tick(t) {
      if (!last) last = t;
      const dt = (t - last) / 1000;
      last = t;

      if (distance > 0) {
        x -= speed * dt;

        // wrap infinito (sin salto). while por si dt viene grande (tab en background)
        while (x <= -distance) x += distance;

        track.style.transform = `translate3d(${x}px,0,0)`;
      }

      raf = requestAnimationFrame(tick);
    }

    function start() {
      stop();

      if (!mq.matches || reduced.matches) {
        removeClones();
        x = 0;
        distance = 0;
        track.style.transform = "translate3d(0,0,0)";
        return;
      }

      ensureClones();

      // Reintento de medición por si todavía no pintó el layout / SVG
      let tries = 0;
      const maxTries = 40;

      const tryMeasure = () => {
        tries++;
        distance = measureDistance();

        if (distance > 0) {
          // mantener x dentro del rango para que no “salte” al recalcular
          x = ((x % distance) + distance) % distance;
          track.style.transform = `translate3d(${-x}px,0,0)`;
          x = -x; // seguimos en negativo para el tick

          raf = requestAnimationFrame(tick);
          return;
        }

        if (tries < maxTries) requestAnimationFrame(tryMeasure);
      };

      requestAnimationFrame(tryMeasure);
    }

    // Recalcular si cambia el layout (orientación, fonts, etc.)
    const ro = new ResizeObserver(() => {
      if (!mq.matches || reduced.matches) return;
      const d = measureDistance();
      if (d > 0) distance = d;
    });
    ro.observe(container);

    window.addEventListener("load", start, { once: true });
    window.addEventListener("resize", start, { passive: true });
    mq.addEventListener?.("change", start);
    reduced.addEventListener?.("change", start);

    start();
  });
})();
