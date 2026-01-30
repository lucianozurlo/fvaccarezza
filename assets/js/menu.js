// Scroll lock automático cuando body tiene .tt-ol-menu-open
(() => {
  const body = document.body;
  const docEl = document.documentElement;

  let locked = false;
  let scrollY = 0;

  const getScrollbarWidth = () => window.innerWidth - docEl.clientWidth;

  function lockScroll() {
    if (locked) return;
    locked = true;

    scrollY = window.scrollY || window.pageYOffset || 0;
    const sbw = getScrollbarWidth();

    // Congela el body en la posición actual
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    // Evita “jump” por desaparición de la scrollbar (desktop)
    if (sbw > 0) body.style.paddingRight = `${sbw}px`;

    docEl.classList.add("tt-scroll-locked");
  }

  function unlockScroll() {
    if (!locked) return;
    locked = false;

    body.style.position = "";
    body.style.top = "";
    body.style.left = "";
    body.style.right = "";
    body.style.width = "";
    body.style.paddingRight = "";

    docEl.classList.remove("tt-scroll-locked");

    // Vuelve al scroll exacto
    window.scrollTo(0, scrollY);
  }

  function sync() {
    if (body.classList.contains("tt-ol-menu-open")) lockScroll();
    else unlockScroll();
  }

  // Inicial
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sync, { once: true });
  } else {
    sync();
  }

  // Detecta cuando cambia la clase del body
  new MutationObserver(sync).observe(body, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // Por si vuelve desde bfcache (Safari/Chrome)
  window.addEventListener("pageshow", sync);
})();
