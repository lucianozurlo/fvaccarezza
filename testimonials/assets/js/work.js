// FANCYBOX
(function () {
   function getInstance() {
      try {
         return window.parent?.Fancybox?.getInstance?.() || null;
      } catch (e) {
         return null;
      }
   }
   function closeMe() {
      const fb = getInstance();
      if (fb) fb.close();
      else if (history.length > 1) history.back();
      else window.close();
   }

   // (Punto 2) Delegación: cerrar al clickear cualquier [data-fancybox-close] dentro del iframe
   document.addEventListener('click', (e) => {
      const el = e.target.closest('a[data-fancybox-close], button[data-fancybox-close]');
      if (!el) return;
      e.preventDefault();
      closeMe();
   });

   // Si tu template trae #closeBtn, lo cableamos sin romper si no existe
   const btn = document.getElementById('closeBtn');
   if (btn)
      btn.addEventListener('click', (e) => {
         e.preventDefault();
         closeMe();
      });

   // ESC para cerrar (iframe standalone)
   window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMe();
   });
})();

