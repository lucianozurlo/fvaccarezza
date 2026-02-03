(() => {
  function setBodyZoom(on) {
    document.body.classList.toggle('zoom-photos', !!on);
  }

  function findIframeFromSource(sourceWin) {
    for (const f of document.querySelectorAll('iframe')) {
      try { if (f.contentWindow === sourceWin) return f; } catch {}
    }
    return null;
  }

  function findModalContainerFromIframe(iframeEl) {
    if (!iframeEl) return null;
    return (
      iframeEl.closest(".modal, [role='dialog'], dialog, .fancybox__container, .fancybox-container, .tt-modal, .modal-wrapper, [data-modal]") ||
      iframeEl.parentElement
    );
  }

  function clickFirstCloseButton(container) {
    if (!container) return false;
    const btn = container.querySelector(
      "[data-zoom-close], [data-dismiss], [data-close], .btn-close, .modal-close, .tt-close, .close, [aria-label='Close']"
    );
    if (btn) { btn.click(); return true; }
    return false;
  }

  function hardHide(container) {
    if (!container) return;
    container.style.display = "none";
    container.classList.remove("is-open","open","show","active");
    container.setAttribute("aria-hidden","true");
    // scroll-lock comunes
    document.body.classList.remove("modal-open");
    document.documentElement.classList.remove("modal-open");
    document.body.style.removeProperty("overflow");
    document.body.style.removeProperty("padding-right");
  }

  function closeContainer(container) {
    if (!container) return;

    // 1) Bootstrap 5
    try {
      if (window.bootstrap?.Modal && container.classList.contains('modal')) {
        const inst = window.bootstrap.Modal.getInstance(container) || new window.bootstrap.Modal(container);
        inst.hide(); setBodyZoom(false); return;
      }
    } catch {}

    // 2) <dialog> nativo
    try {
      if (container.tagName?.toLowerCase() === 'dialog' && typeof container.close === 'function') {
        container.close(); setBodyZoom(false); return;
      }
    } catch {}

    // 3) Fancybox
    try {
      if (window.Fancybox?.close) { window.Fancybox.close(); setBodyZoom(false); return; }
    } catch {}

    // 4) Click en X
    if (clickFirstCloseButton(container)) { setBodyZoom(false); return; }

    // 5) Fallback
    hardHide(container); setBodyZoom(false);
  }

  function focusIframe(iframeEl) {
    if (!iframeEl) return;
    if (!iframeEl.hasAttribute('tabindex')) iframeEl.setAttribute('tabindex','0');
    try { iframeEl.focus({ preventScroll:true }); } catch { try { iframeEl.focus(); } catch {} }
    try { iframeEl.contentWindow?.focus(); } catch {}
  }

  // Mensajes desde iframes
  window.addEventListener('message', (ev) => {
    const data = ev.data || {};
    if (!data || typeof data !== 'object') return;

    if (data.type === 'ZOOMPHOTOS_BODY') {
      setBodyZoom(!!data.on);
      return;
    }
    if (data.type === 'ZOOMPHOTOS_FOCUS_IFRAME1') {
      const iframeEl = findIframeFromSource(ev.source);
      focusIframe(iframeEl);
      return;
    }
    if (data.type === 'ZOOMPHOTOS_CLOSE_MODAL1') {
      const iframeEl = findIframeFromSource(ev.source);
      const container = findModalContainerFromIframe(iframeEl);
      closeContainer(container);
      return;
    }
  });

  // Reset al click en el logo (opcional)
  const logo = document.getElementById('main-logo');
  if (logo) logo.addEventListener('click', () => document.body.classList.remove('zoom-photos'));
})();
