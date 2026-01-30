(function () {
  const root = document.documentElement;

  // CLICK: respeta data-vt-mode / data-vt-dir del link.
  // Default: fade.
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;

      const mode = a.dataset.vtMode || "fade"; // fade | slide
      const dir = a.dataset.vtDir || ""; // prev | next (solo slide)

      // 1) Setear en el doc actual (snapshot viejo)
      root.dataset.vtMode = mode;
      if (mode === "slide") root.dataset.vtDir = dir || "next";
      else delete root.dataset.vtDir;

      // 2) Persistir para el doc destino (snapshot nuevo)
      sessionStorage.setItem("vt_mode", mode);
      if (mode === "slide") sessionStorage.setItem("vt_dir", dir || "next");
      else sessionStorage.removeItem("vt_dir");
    },
    { capture: true },
  );

  // SWIPE: solo en páginas con data-prev/data-next (p1..p6)
  const prevUrl = document.body?.dataset?.prev;
  const nextUrl = document.body?.dataset?.next;
  if (!prevUrl && !nextUrl) return;

  const isMobile =
    matchMedia("(pointer: coarse)").matches ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

  if (!isMobile) return;

  let startX = 0,
    startY = 0,
    startT = 0,
    tracking = false;
  const minDistance = 70;
  const maxVertical = 60;
  const maxTime = 650;

  window.addEventListener(
    "pointerdown",
    (e) => {
      if (e.pointerType && e.pointerType !== "touch") return;
      if (e.isPrimary === false) return;

      tracking = true;
      startX = e.clientX;
      startY = e.clientY;
      startT = performance.now();
    },
    { passive: true },
  );

  window.addEventListener(
    "pointerup",
    (e) => {
      if (!tracking) return;
      tracking = false;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const dt = performance.now() - startT;

      if (dt > maxTime) return;
      if (Math.abs(dy) > maxVertical) return;
      if (Math.abs(dx) < minDistance) return;

      if (dx < 0 && nextUrl) {
        root.dataset.vtMode = "slide";
        root.dataset.vtDir = "next";
        sessionStorage.setItem("vt_mode", "slide");
        sessionStorage.setItem("vt_dir", "next");
        location.assign(nextUrl);
        return;
      }

      if (dx > 0 && prevUrl) {
        root.dataset.vtMode = "slide";
        root.dataset.vtDir = "prev";
        sessionStorage.setItem("vt_mode", "slide");
        sessionStorage.setItem("vt_dir", "prev");
        location.assign(prevUrl);
      }
    },
    { passive: true },
  );

  window.addEventListener(
    "pointercancel",
    () => {
      tracking = false;
    },
    { passive: true },
  );
})();
