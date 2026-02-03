(() => {
  const preloader = document.getElementById("preloader");
  const underlay = document.getElementById("preloader-under");
  if (!preloader) return;

  document.documentElement.classList.add("no-scroll");

  const percentEl = preloader.querySelector("[data-percent]");

  let displayed = 0;
  let target = 0;
  let finished = false;

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const setTarget = (v) => (target = clamp(v, target, 100)); // nunca baja

  const bumpByState = () => {
    switch (document.readyState) {
      case "loading":
        setTarget(10);
        break;
      case "interactive":
        setTarget(45);
        break;
      case "complete":
        setTarget(100);
        break;
    }
  };

  document.addEventListener("readystatechange", bumpByState);
  document.addEventListener("DOMContentLoaded", () => setTarget(65));
  window.addEventListener("load", () => setTarget(100));

  const trackImages = () => {
    const imgs = Array.from(document.images || []);
    const pending = imgs.filter((img) => !img.complete);

    if (pending.length === 0) {
      setTarget(Math.max(target, 80));
      return;
    }

    const total = pending.length;
    let loaded = 0;

    const onAsset = () => {
      loaded++;
      const p = 20 + Math.round((loaded / total) * 70);
      setTarget(p);
      if (loaded >= total) setTarget(90);
    };

    pending.forEach((img) => {
      img.addEventListener("load", onAsset, { once: true });
      img.addEventListener("error", onAsset, { once: true });
    });
  };

  const render = () => {
    displayed += (target - displayed) * 0.12;

    if (Math.abs(target - displayed) < 0.15) displayed = target;

    const p = Math.round(displayed);
    if (percentEl) percentEl.textContent = `(${p}%)`;

    if (!finished && target === 100 && p === 100) finish();
    if (!finished) requestAnimationFrame(render);
  };

  const cleanup = () => {
    preloader?.remove();
    underlay?.remove();
    document.documentElement.classList.remove("no-scroll");
  };

  const finish = () => {
    finished = true;

    if (
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      cleanup();
      return;
    }

    preloader.classList.add("is-done");
    if (underlay) underlay.classList.add("is-done");

    if (underlay) {
      underlay.addEventListener(
        "animationend",
        (e) => {
          if (e.animationName !== "underlay-out") return;
          cleanup();
        },
        { once: true }
      );
    } else {
      preloader.addEventListener(
        "animationend",
        (e) => {
          if (e.animationName !== "preloader-out") return;
          cleanup();
        },
        { once: true }
      );
    }
  };

  bumpByState();
  trackImages();
  requestAnimationFrame(render);

  // Hook opcional para controlar progreso manual
  window.__setLoaderProgress = (v) => setTarget(clamp(v, 0, 100));
})();

// ocultar loading de fancybox
// Fancybox.bind("[data-fancybox]", {
//   showLoading: false, // si tu build lo respeta
// });
