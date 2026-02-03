// SCROLL
// Si tenés un header fijo, poné su altura acá:
const HEADER_HEIGHT = 0; // ej: 76

document
  .getElementById("scroll-inside")
  .addEventListener("click", function (e) {
    e.preventDefault();

    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const linkTopAbs = window.scrollY + rect.top;

    // Scrollea hasta un punto *apenas* después del final del <a>,
    // compensando un posible header fijo para que quede completamente oculto.
    const targetY = linkTopAbs + el.offsetHeight - HEADER_HEIGHT + 1;

    window.scrollTo({
      top: targetY,
      behavior: "smooth",
    });
  });
