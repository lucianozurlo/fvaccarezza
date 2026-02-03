$ (document).ready (function () {
  // Selecciona los elementos correspondientes
  const pageHeader = $ ('#page-header');
  const aboutDiv = $ ('#about');
  const workDiv = $ ('#work');

  // Variable para rastrear si la clase está activa
  let isClassAdded = false;
  let observerActive = true; // Para rastrear si el observador está activo

  // Crea una instancia de IntersectionObserver
  const observer = new IntersectionObserver (
    entries => {
      // Solo procesar si el observador está activo
      if (!observerActive) return;

      // Variables para almacenar la visibilidad actual de los elementos
      let pageHeaderVisible = 0;
      let aboutVisible = 0;
      let workVisible = 0;

      entries.forEach (entry => {
        const targetId = entry.target.id;
        const intersectionRatio = entry.intersectionRatio;

        // Asigna la visibilidad según el elemento observado
        if (targetId === 'page-header') {
          pageHeaderVisible = intersectionRatio;
        } else if (targetId === 'about') {
          aboutVisible = intersectionRatio;
        } else if (targetId === 'work') {
          workVisible = intersectionRatio;
        }

        // Log para verificar la visibilidad
        console.log (`Element: #${targetId}, Visibility: ${intersectionRatio}`);
      });

      // Condición mandatoria: Si el div "page-header" es visible más del 95%, no ejecutar más condiciones
      if (pageHeaderVisible > 0.95) {
        if (isClassAdded) {
          $ ('body').removeClass ('psi-light-image-on');
          isClassAdded = false;
          console.log ('Class removed: psi-light-image-on (page-header > 95%)');
        }
        return; // Salir de la función si esta condición es verdadera
      }

      // Si "page-header" es visible 5% o menos y "about" es visible 30% o más, agregar la clase
      if (pageHeaderVisible <= 0.05 && aboutVisible >= 0.30) {
        if (!isClassAdded) {
          $ ('body').addClass ('psi-light-image-on');
          isClassAdded = true;
          console.log (
            'Class added: psi-light-image-on (page-header <= 5% and about >= 30%)'
          );
        }
      } else if (aboutVisible <= 0.15 && workVisible >= 0.30) {
        // Si "about" es visible 15% o menos y "work" es visible 30% o más, NO agregar la clase
        if (isClassAdded) {
          $ ('body').removeClass ('psi-light-image-on');
          isClassAdded = false;
          console.log (
            'Class removed: psi-light-image-on (about <= 15% and work >= 30%)'
          );
        }
      }
    },
    {
      root: null, // Usa el viewport como raíz
      threshold: Array.from ({length: 101}, (_, i) => i / 100), // Umbrales del 0% al 100%
    }
  );

  // Observamos los tres divs
  observer.observe (pageHeader[0]);
  observer.observe (aboutDiv[0]);
  observer.observe (workDiv[0]);

  // Comportamiento de los enlaces del menú
  $ ('.tt-main-menu-list a').on ('click', function (event) {
    const targetId = $ (this).attr ('href'); // Obtener el ID del elemento destino

    // Evitar el comportamiento predeterminado del enlace
    event.preventDefault ();

    // Desactivar el observer por 4 segundos
    observerActive = false;

    // Manejar la clase según el elemento al que se hace clic
    setTimeout (() => {
      if (targetId === '#about') {
        // Agregar la clase solo si no está activa
        if (!isClassAdded) {
          $ ('body').addClass ('psi-light-image-on');
          isClassAdded = true;
          console.log (
            'Class added after 1 second: psi-light-image-on (clicked on About)'
          );
        }
      } else {
        // Eliminar la clase si se hace clic en otros enlaces
        if (isClassAdded) {
          $ ('body').removeClass ('psi-light-image-on');
          isClassAdded = false;
          console.log (
            'Class removed after 1 second: psi-light-image-on (clicked on other links)'
          );
        }
      }

      // Reactivar el observer después de 4 segundos
      setTimeout (() => {
        observerActive = true;
      }, 1000); // Reactivar el observer después de 4 segundos
    }, 1000); // Retraso de 1 segundo para agregar/remover clase
  });
});
