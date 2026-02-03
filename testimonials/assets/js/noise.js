(() => {
  document.querySelectorAll(".noise-fill-hover").forEach((el) => {
    // Si ya está armado, salteo
    if (el.querySelector(".noise-fill-hover__solid")) return;

    // Tomo solo texto plano
    const text = el.textContent;
    if (!text || !text.trim()) return;

    // Limpio y creo capas
    el.textContent = "";

    const noise = document.createElement("span");
    noise.className = "noise-fill-hover__noise";
    noise.setAttribute("aria-hidden", "true");
    noise.textContent = text;

    const solid = document.createElement("span");
    solid.className = "noise-fill-hover__solid";
    solid.textContent = text;

    // Orden: noise arriba (absolute), solid abajo (flujo normal)
    el.appendChild(noise);
    el.appendChild(solid);
  });
})();
