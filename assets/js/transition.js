// =========================
// nav.js
// =========================
(function () {
  const root = document.documentElement;

  const readMsVar = (name, fallback) => {
    const raw = getComputedStyle(root).getPropertyValue(name).trim();
    if (!raw) return fallback;
    if (raw.endsWith("ms")) return parseFloat(raw) || fallback;
    if (raw.endsWith("s")) return parseFloat(raw) * 1000 || fallback;
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  // Si tu nav.css define estas vars, las lee; si no, usa defaults.
  const FADE_MS = readMsVar("--fade-dur", 1000);
  const SLIDE_MS = readMsVar("--slide-dur", 1000);

  // Aplicar VT entrante (para el snapshot NEW)
  (function applyIncomingVT() {
    const mode = sessionStorage.getItem("vt_mode");
    const dir = sessionStorage.getItem("vt_dir");

    if (!mode) return;

    root.dataset.vtMode = mode;
    if (mode === "slide") root.dataset.vtDir = dir || "next";
    else delete root.dataset.vtDir;

    const dur = mode === "slide" ? SLIDE_MS : FADE_MS;

    // limpiar después de la transición
    setTimeout(() => {
      delete root.dataset.vtMode;
      delete root.dataset.vtDir;
    }, dur + 80);
  })();

  // CLICK en links: setea modo/dirección según data-*
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target.closest("a[href]");
      if (!a) return;

      // ignorar anchors
      const hrefAttr = a.getAttribute("href");
      if (!hrefAttr || hrefAttr === "#" || hrefAttr.startsWith("#")) return;

      const mode = a.dataset.vtMode || "fade"; // fade | slide
      const dir = a.dataset.vtDir || ""; // prev | next (solo slide)

      // setear para snapshot old
      root.dataset.vtMode = mode;
      if (mode === "slide") root.dataset.vtDir = dir || "next";
      else delete root.dataset.vtDir;

      // persistir para snapshot new
      sessionStorage.setItem("vt_mode", mode);
      if (mode === "slide") sessionStorage.setItem("vt_dir", dir || "next");
      else sessionStorage.removeItem("vt_dir");
    },
    { capture: true },
  );

  // ============================
  // Prev/Next programático (slide)
  // ============================
  function go(dir) {
    const prev = document.body?.dataset?.prev;
    const next = document.body?.dataset?.next;

    const target = dir === "prev" ? prev : dir === "next" ? next : null;
    if (!target) return;

    const url = new URL(target, location.href).href;

    root.dataset.vtMode = "slide";
    root.dataset.vtDir = dir;

    sessionStorage.setItem("vt_mode", "slide");
    sessionStorage.setItem("vt_dir", dir);

    location.assign(url);
  }

  // Botones prev/next (data-carousel-prev / data-carousel-next)
  document.addEventListener("click", (e) => {
    const prevBtn = e.target.closest('[data-carousel-prev="true"]');
    const nextBtn = e.target.closest('[data-carousel-next="true"]');
    if (!prevBtn && !nextBtn) return;

    e.preventDefault();
    go(prevBtn ? "prev" : "next");
  });

  // Teclas ← / → (ignora inputs + ignora modal abierto)
  function isTypingContext(el) {
    if (!el) return false;
    const tag = el.tagName?.toLowerCase();
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  document.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;

    if (
      root.classList.contains("modal-open") ||
      document.body.classList.contains("modal-open")
    )
      return;
    if (isTypingContext(document.activeElement)) return;

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      go("prev");
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      go("next");
    }
  });

  // ============================
  // Prefetch prev/next (document)
  // ============================
  (function prefetchNeighbors() {
    const prev = document.body?.dataset?.prev;
    const next = document.body?.dataset?.next;
    if (!prev && !next) return;

    const abs = (u) => new URL(u, location.href).href;
    const urls = [];
    if (prev) urls.push(abs(prev));
    if (next) urls.push(abs(next));

    // hint
    urls.forEach((u) => {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "document";
      link.href = u;
      document.head.appendChild(link);
    });

    // warm cache (idle)
    const c = navigator.connection;
    if (c && (c.saveData || /2g/.test(c.effectiveType))) return;

    const run = () => {
      urls.forEach((u) => {
        fetch(u, {
          method: "GET",
          credentials: "same-origin",
          cache: "force-cache",
          keepalive: true,
        }).catch(() => {});
      });
    };

    if ("requestIdleCallback" in window)
      requestIdleCallback(run, { timeout: 1200 });
    else setTimeout(run, 250);
  })();

  // ============================
  // SWIPE (mobile): slide prev/next
  // + bloquear scroll vertical mientras es gesto horizontal
  // + NO corre si hay modal abierto
  // ============================
  (function setupSwipeNav() {
    const prevRaw = document.body?.dataset?.prev || null;
    const nextRaw = document.body?.dataset?.next || null;
    if (!prevRaw && !nextRaw) return;

    const isMobile =
      matchMedia("(pointer: coarse)").matches ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    if (!isMobile) return;

    const prevUrl = prevRaw ? new URL(prevRaw, location.href).href : null;
    const nextUrl = nextRaw ? new URL(nextRaw, location.href).href : null;

    let startX = 0,
      startY = 0,
      startT = 0,
      startScrollY = 0;
    let tracking = false;
    let axis = null; // null | "x" | "y"
    let activePointerId = null;

    const minDistance = 70;
    const maxVertical = 80;
    const maxTime = 800;
    const decideAxisPx = 8;

    function modalIsOpen() {
      return (
        root.classList.contains("modal-open") ||
        document.body.classList.contains("modal-open")
      );
    }

    function decideAxisFrom(dx, dy) {
      if (Math.abs(dx) < decideAxisPx && Math.abs(dy) < decideAxisPx)
        return null;
      return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    }

    function endGesture() {
      tracking = false;
      axis = null;
      activePointerId = null;
    }

    document.addEventListener(
      "pointerdown",
      (e) => {
        if (modalIsOpen()) return;
        if (e.pointerType && e.pointerType !== "touch") return;
        if (e.isPrimary === false) return;

        tracking = true;
        axis = null;
        activePointerId = e.pointerId;

        startX = e.clientX;
        startY = e.clientY;
        startT = performance.now();
        startScrollY = window.scrollY;
      },
      { passive: true },
    );

    document.addEventListener(
      "pointermove",
      (e) => {
        if (modalIsOpen()) return;
        if (!tracking) return;
        if (activePointerId !== null && e.pointerId !== activePointerId) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        if (!axis) axis = decideAxisFrom(dx, dy);
        if (axis !== "x") return;

        // gesto horizontal => bloquear scroll vertical
        if (e.cancelable) e.preventDefault();
        if (window.scrollY !== startScrollY) window.scrollTo(0, startScrollY);
      },
      { passive: false },
    );

    document.addEventListener(
      "pointerup",
      (e) => {
        if (modalIsOpen()) {
          endGesture();
          return;
        }
        if (!tracking) return;
        if (activePointerId !== null && e.pointerId !== activePointerId) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const dt = performance.now() - startT;

        if (!axis) axis = decideAxisFrom(dx, dy);
        if (axis !== "x") {
          endGesture();
          return;
        }

        if (dt > maxTime) {
          endGesture();
          return;
        }
        if (Math.abs(dy) > maxVertical) {
          endGesture();
          return;
        }
        if (Math.abs(dx) < minDistance) {
          endGesture();
          return;
        }

        if (dx < 0 && nextUrl) {
          root.dataset.vtMode = "slide";
          root.dataset.vtDir = "next";
          sessionStorage.setItem("vt_mode", "slide");
          sessionStorage.setItem("vt_dir", "next");
          location.assign(nextUrl);
          endGesture();
          return;
        }

        if (dx > 0 && prevUrl) {
          root.dataset.vtMode = "slide";
          root.dataset.vtDir = "prev";
          sessionStorage.setItem("vt_mode", "slide");
          sessionStorage.setItem("vt_dir", "prev");
          location.assign(prevUrl);
          endGesture();
          return;
        }

        endGesture();
      },
      { passive: true },
    );

    document.addEventListener("pointercancel", () => endGesture(), {
      passive: true,
    });
  })();
})();
