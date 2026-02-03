(() => {
  const cursor = document.querySelector(".fx-cursor");
  if (!cursor) return;

  // ===== Config =====
  const LERP = 0.22;
  const INTERACTIVE_SELECTOR = [
    "a[href]",
    "button",
    "label",
    '[role="button"]',
    'input[type="button"]',
    'input[type="submit"]',
    ".btn",
    ".button",
    ".f-button", // Fancybox
    ".swiper-button-next",
    ".swiper-button-prev", // Swiper
  ].join(",");

  let x = -100,
    y = -100,
    tx = x,
    ty = y;
  let scale = 1;

  // Track global pointer
  const onPMove = (e) => {
    tx = e.clientX;
    ty = e.clientY;
  };
  [window, document, document.documentElement, document.body].forEach((t) => {
    t?.addEventListener("pointermove", onPMove, {
      capture: true,
      passive: true,
    });
  });

  // Loop (suavizado + hit-test)
  const loop = () => {
    x += (tx - x) * LERP;
    y += (ty - y) * LERP;
    cursor.style.setProperty("--x", x - 5 + "px");
    cursor.style.setProperty("--y", y - 5 + "px");

    const el = document.elementFromPoint(Math.round(tx), Math.round(ty));
    const isInteractive =
      !!el &&
      (el.matches?.(INTERACTIVE_SELECTOR) ||
        el.closest?.(INTERACTIVE_SELECTOR));
    const nextScale = isInteractive ? 0 : 1;
    if (nextScale !== scale) {
      scale = nextScale;
      cursor.style.setProperty("--s", String(scale));
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Ocultar/mostrar al salir/entrar del viewport (opcional)
  window.addEventListener("mouseleave", () =>
    cursor.style.setProperty("--s", "0")
  );
  window.addEventListener("mouseenter", () =>
    cursor.style.setProperty("--s", "1")
  );

  // ===== Helpers exportados para el puente de Fancybox =====
  function hookSameOriginIframe(iframe) {
    try {
      const win = iframe.contentWindow;
      if (!win || !iframe.contentDocument) return false;

      // Forward de pointermove dentro del iframe (coords -> padre)
      const onIF = (ev) => {
        const r = iframe.getBoundingClientRect();
        tx = r.left + ev.clientX;
        ty = r.top + ev.clientY;
      };
      win.addEventListener("pointermove", onIF, { passive: true });

      // Limpieza cuando cierre
      iframe._fxCleanup = () => {
        try {
          win.removeEventListener("pointermove", onIF);
        } catch {}
      };
      return true;
    } catch {
      return false;
    } // cross-origin
  }

  function hookCrossOriginIframe(iframe) {
    // No se puede seguir el puntero adentro -> ocultar para que no “quede clavado”
    iframe.addEventListener("mouseenter", () =>
      cursor.style.setProperty("--s", "0")
    );
    iframe.addEventListener("mouseleave", () =>
      cursor.style.setProperty("--s", "1")
    );
  }

  // Exponer API mínima para el otro archivo
  window.__fxCursor = { onPMove, hookSameOriginIframe, hookCrossOriginIframe };
})();
