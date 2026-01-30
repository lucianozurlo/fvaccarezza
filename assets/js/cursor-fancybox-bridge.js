(() => {
  const api = window.__fxCursor;
  if (!api) return; // asegurar que cursor-follow.js cargó primero

  const { onPMove, hookSameOriginIframe, hookCrossOriginIframe } = api;

  function hookFancyboxIframes(root=document){
    root.querySelectorAll('.fancybox__container iframe').forEach(ifr => {
      if (ifr._fxHooked) return;
      ifr._fxHooked = true;

      const tryHook = () => {
        if (!hookSameOriginIframe(ifr)) hookCrossOriginIframe(ifr);
      };

      if (ifr.dataset.ready === 'true' || ifr.complete || ifr.readyState === 'complete') {
        tryHook();
      } else {
        ifr.addEventListener('load', tryHook, { once:true });
      }
    });
  }

  function hookFancyboxContainers(root=document){
    root.querySelectorAll(
      '.fancybox__container, .fancybox__viewport, .fancybox__track, .fancybox__slide, .fancybox__content'
    ).forEach(el => el.addEventListener('pointermove', onPMove, { capture:true, passive:true }));
  }

  // Detectar apariciones dinámicas (al abrir Fancybox/carruseles)
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes || []) {
        if (n.nodeType !== 1) continue;
        if (
          n.matches?.('.fancybox__container, .fancybox__viewport, .fancybox__track, .fancybox__slide, .fancybox__content') ||
          n.querySelector?.('.fancybox__container, .fancybox__viewport, .fancybox__track, .fancybox__slide, .fancybox__content')
        ) {
          const scope = n.querySelector ? n : document;
          hookFancyboxContainers(scope);
          hookFancyboxIframes(scope);
        }
      }
    }
  });
  mo.observe(document.body, { childList:true, subtree:true });

  // Eventos nativos Fancybox v5
  document.addEventListener('fancybox:show', e => {
    const c = e?.detail?.instance?.container;
    if (c){ hookFancyboxContainers(c); hookFancyboxIframes(c); }
  });
  document.addEventListener('fancybox:done', e => {
    const c = e?.detail?.instance?.container;
    if (c){ hookFancyboxContainers(c); hookFancyboxIframes(c); }
  });
  document.addEventListener('fancybox:closing', e => {
    e?.detail?.instance?.container?.querySelectorAll?.('iframe')
      .forEach(ifr => { ifr._fxCleanup?.(); });
  });
})();
