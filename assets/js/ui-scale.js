/* ui-scale.js
   - Freeze/scale entre 1500 y 960
   - Retina => 0.8
   - Setea height del stage para que el scroll sea correcto
   - Agrega clase html.ui-freeze cuando el freeze está activo
*/

(() => {
  const DESIGN_W = 1500;
  const BREAK_W = 960;

  // Retina => 80% (tal cual pediste: “todas las pantallas retina”)
  const RETINA_SCALE = 0.8;

  const stage = document.querySelector(".ui-scale-stage");
  const root = document.getElementById("body-inner");
  if (!stage || !root) return;

  function computeScale() {
    const vw =
      window.innerWidth || document.documentElement.clientWidth || DESIGN_W;
    const dpr = window.devicePixelRatio || 1;

    const isFreezeRange = vw < DESIGN_W && vw > BREAK_W;
    document.documentElement.classList.toggle("ui-freeze", isFreezeRange);

    // Freeze: 1500->960 escala lineal (vw/1500). Fuera: 1
    let freezeScale = 1;
    if (isFreezeRange) freezeScale = vw / DESIGN_W;

    // Retina: dpr>=2 => 0.8
    const retinaScale = dpr >= 2 ? RETINA_SCALE : 1;

    const finalScale = +(freezeScale * retinaScale).toFixed(4);

    // Aplico scale solo si NO estoy en mobile responsive (<=960)
    if (vw > BREAK_W) {
      document.documentElement.style.setProperty("--ui-scale", finalScale);

      // El root está absolute: el transform NO afecta el layout -> seteo alto manual
      const h = root.offsetHeight * finalScale;
      stage.style.height = `${Math.ceil(h)}px`;
    } else {
      document.documentElement.style.setProperty("--ui-scale", 1);
      stage.style.height = "";
    }
  }

  const raf = () => requestAnimationFrame(computeScale);

  window.addEventListener("resize", raf, { passive: true });
  window.addEventListener("orientationchange", raf, { passive: true });
  window.addEventListener("load", raf);

  // Recalcular si cambia la altura por imágenes/fuentes
  new ResizeObserver(raf).observe(root);

  computeScale();
})();
