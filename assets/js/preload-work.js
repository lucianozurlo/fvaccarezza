(() => {
  const preloader = document.getElementById("preloader");
  if (!preloader) return;

  const root = document.documentElement;

  // Bloqueo scroll + sitio invisible hasta terminar
  root.classList.add("no-scroll", "is-preloading");

  const prefersReduce = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;

  const cleanup = () => {
    preloader.remove();
    root.classList.remove("no-scroll");
  };

  const finish = () => {
    // Sitio visible (fade-in a opacidad 1)
    root.classList.remove("is-preloading");
    root.classList.add("is-loaded");

    // Si reduce motion, sin animaciones
    if (prefersReduce) {
      cleanup();
      return;
    }

    // Fade-out del overlay
    preloader.classList.add("is-done");

    const removeAfter = () => cleanup();

    preloader.addEventListener(
      "transitionend",
      (e) => {
        if (e.propertyName !== "opacity") return;
        removeAfter();
      },
      { once: true },
    );

    // Failsafe por si no dispara transitionend
    setTimeout(removeAfter, 900);
  };

  // Si el load ya pasó cuando entra este script
  if (document.readyState === "complete") {
    finish();
  } else {
    window.addEventListener("load", finish, { once: true });
  }
})();
