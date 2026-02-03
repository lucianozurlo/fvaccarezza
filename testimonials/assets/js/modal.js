// modal.js — modal accesible sin dependencias + integración con Fancybox (sin hashes)
// + animación: entrada desde arriba con rebote + salida hacia arriba (usa .is-closing)
(function () {
  const OPEN_ATTR = "data-modal-open";
  const CLOSE_ATTR = "data-modal-close";
  const CLEAR_GALLERY_ATTR = "data-clear-gallery";
  const TARGET_ATTR = "data-gallery-target"; // abre galería en 'slug'

  // Debe matchear el CSS: --modal-close-ms (420ms)
  const CLOSE_ANIM_MS = 420;

  let lastActiveTrigger = null;

  // Fancybox helpers
  const getFB = () => window.Fancybox?.getInstance?.() || null;

  function clearUrlHash() {
    try {
      const url = location.pathname + location.search;
      history.replaceState(null, "", url);
    } catch {
      if (location.hash) location.hash = "";
    }
  }

  function closeFancyboxAndClearHash() {
    const fb = getFB();
    try {
      fb?.close?.();
    } catch {}
    clearUrlHash();
    document.documentElement.classList.remove("with-fancybox-gallery");
  }

  // Abrir modal por selector (#id)
  function openModal(selector) {
    const modal = document.querySelector(selector);
    if (!modal) return;

    lastActiveTrigger = document.activeElement;

    // Si estaba cerrando, frenalo
    modal.classList.remove("is-closing");

    modal.classList.add("is-open");
    modal.removeAttribute("aria-hidden");

    document.documentElement.classList.add("modal-open");
    document.body.classList.add("modal-open");

    trapFocus(modal, true);

    modal.addEventListener("keydown", onKeyDown);
    modal.addEventListener("click", onClickClose);
  }

  // Cerrar modal (espera animación de salida hacia arriba)
  function closeModal(modal) {
    if (!modal) return;

    // Evita doble cierre
    if (modal.classList.contains("is-closing")) return;

    const dialog = modal.querySelector(".modal__dialog");

    // Dispara animación CSS
    modal.classList.add("is-closing");
    modal.classList.remove("is-open");

    const finish = () => {
      modal.classList.remove("is-closing");
      modal.setAttribute("aria-hidden", "true");

      document.documentElement.classList.remove("modal-open");
      document.body.classList.remove("modal-open");

      modal.removeEventListener("keydown", onKeyDown);
      modal.removeEventListener("click", onClickClose);

      if (lastActiveTrigger && typeof lastActiveTrigger.focus === "function") {
        lastActiveTrigger.focus();
      }
    };

    // Espera animationend del dialog (con fallback)
    let done = false;

    const onEnd = (e) => {
      if (done) return;
      if (e.target !== dialog) return;
      done = true;
      dialog.removeEventListener("animationend", onEnd);
      finish();
    };

    if (dialog) {
      dialog.addEventListener("animationend", onEnd);
      setTimeout(() => {
        if (done) return;
        done = true;
        dialog.removeEventListener("animationend", onEnd);
        finish();
      }, CLOSE_ANIM_MS + 120);
    } else {
      setTimeout(finish, CLOSE_ANIM_MS);
    }
  }

  // Delegación global para abrir modales
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(`[${OPEN_ATTR}]`);
    if (!btn) return;

    e.preventDefault();

    const target = btn.getAttribute(OPEN_ATTR);
    if (!target) return;

    openModal(target);
  });

  // Handler dentro del modal: cerrar (y opcionalmente abrir galería)
  function onClickClose(e) {
    const isBackdrop = e.target.matches(".modal__backdrop");
    const closeBtn = e.target.closest(`[${CLOSE_ATTR}]`);
    if (!isBackdrop && !closeBtn) return;

    const modal = e.currentTarget.closest(".modal") || e.currentTarget;

    // ¿El botón también pide abrir galería?
    const targetSlug = closeBtn?.getAttribute?.(TARGET_ATTR);

    // ¿Pide limpiar/cerrar galería Fancybox?
    if (closeBtn?.hasAttribute(CLEAR_GALLERY_ATTR)) {
      closeFancyboxAndClearHash();
    }

    // Cierra modal (animado)
    closeModal(modal);

    // Si hay slug, abrimos galería cuando terminó el cierre
    if (
      targetSlug &&
      window.Gallery &&
      typeof window.Gallery.openBySlug === "function"
    ) {
      setTimeout(() => window.Gallery.openBySlug(targetSlug), CLOSE_ANIM_MS);
    }
  }

  // Esc + focus trap
  function onKeyDown(e) {
    const modal = e.currentTarget.closest(".modal") || e.currentTarget;

    if (e.key === "Escape") {
      e.preventDefault();
      closeModal(modal);
      return;
    }

    if (e.key === "Tab") {
      const focusables = getFocusable(modal);
      if (!focusables.length) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Focus utils
  function trapFocus(modal, focusFirst) {
    const focusables = getFocusable(modal);
    if (focusFirst && focusables.length) {
      const closeBtn = modal.querySelector(`[${CLOSE_ATTR}]`);
      (closeBtn || focusables[0]).focus();
    }
  }

  function getFocusable(root) {
    const selectors = [
      "a[href]",
      "button:not([disabled])",
      "input:not([disabled])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      '[tabindex]:not([tabindex="-1"])',
    ].join(",");

    return Array.from(root.querySelectorAll(selectors)).filter(
      (el) =>
        !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    );
  }

  // Helpers públicos
  window.openModal = openModal;
  window.closeModal = (selectorOrEl) => {
    const modal =
      typeof selectorOrEl === "string"
        ? document.querySelector(selectorOrEl)
        : selectorOrEl;
    closeModal(modal);
  };
  window.closeFancyboxAndClearHash = closeFancyboxAndClearHash;
})();
