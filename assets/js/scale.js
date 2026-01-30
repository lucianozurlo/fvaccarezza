/* scale.js — freeze @1500 → scale down to 960 + retina 0.8 (desktop)
   Requiere: <main id="body-inner">
*/
(() => {
  const root = document.documentElement;
  const main = document.getElementById("body-inner");
  if (!main) return;

  const BASE_W = 1500; // “diseño” congelado en no-retina
  const BP = 960; // breakpoint donde dejás de escalar y entra tu responsive
  const RETINA_FACTOR = 0.8;
  const RETINA_MIN_DPR = 2;

  const supportsZoom = CSS?.supports?.("zoom", "1") ?? false;
  if (!supportsZoom) root.classList.add("no-zoom");

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

  function compute() {
    const vw = Math.max(
      document.documentElement.clientWidth,
      window.innerWidth || 0,
    );
    const dpr = window.devicePixelRatio || 1;
    const isRetina = dpr >= RETINA_MIN_DPR;

    const isDesktop = vw > BP;

    let scale = 1;
    let freezeW = 0;

    // --- Rango “freeze”: (960, 1500] ---
    if (vw > BP && vw <= BASE_W) {
      // En retina, para que “quepa” ocupando 100% del viewport
      // y aun así sea 80% de tamaño, agrandamos el ancho virtual.
      const virtualBase =
        isDesktop && isRetina ? BASE_W / RETINA_FACTOR : BASE_W;

      freezeW = virtualBase;
      scale = vw / virtualBase; // a 1500 => 1 (no-retina) / 0.8 (retina); a 960 => encaja exacto
    }
    // --- Desktop retina fuera del freeze (vw > 1500): 80% fijo ---
    else if (isDesktop && isRetina) {
      scale = RETINA_FACTOR;
      freezeW = 0;
    }
    // --- Mobile (<=960): no tocar, manda tu responsive.css ---
    else {
      scale = 1;
      freezeW = 0;
    }

    // seguridad
    scale = clamp(scale, 0.5, 1);

    root.style.setProperty("--site-scale", scale.toFixed(4));
    if (freezeW) root.style.setProperty("--site-freeze-w", `${freezeW}px`);

    root.classList.toggle("site-zoom", Math.abs(scale - 1) > 0.001);
    root.classList.toggle("site-freeze", !!freezeW);
  }

  let raf = 0;
  const schedule = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(compute);
  };

  window.addEventListener("resize", schedule, { passive: true });
  window.addEventListener("orientationchange", schedule, { passive: true });

  compute();
})();
