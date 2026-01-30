/*!
 * Fade + Parallax (fx-)
 * - Fade-in una sola vez con IntersectionObserver
 * - Parallax por transform con requestAnimationFrame
 * - Config por data-attributes
 *   data-parallax-speed="0.3"   (positivo: acompaña scroll; negativo: contra)
 *   data-parallax-clamp="240"   (límite px del recorrido; opcional)
 *   data-parallax-bg            (si querés mover background-position en vez de transform)
 *   data-parallax-force         (en el <html> para ignorar prefers-reduced-motion)
 */
(function () {
   // ==== FADE-IN UNA SOLA VEZ ====
   function initFadeOnce() {
      var items = document.querySelectorAll('.fx-reveal');
      if (!items.length) return;

      if (!('IntersectionObserver' in window)) {
         items.forEach(function (el) {
            el.classList.add('is-visible');
         });
         return;
      }

      var io = new IntersectionObserver(
         function (entries, obs) {
            entries.forEach(function (e) {
               if (e.isIntersecting) {
                  e.target.classList.add('is-visible');
                  obs.unobserve(e.target); // queda estático hasta recargar
               }
            });
         },
         { root: null, threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
      );

      items.forEach(function (el) {
         io.observe(el);
      });
   }

   // ==== PARALLAX (transform o background) ====
   function initParallax() {
      var all = Array.prototype.slice.call(document.querySelectorAll('[data-parallax-speed]'));
      if (!all.length) return;

      var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      var force = document.documentElement.hasAttribute('data-parallax-force');
      if (reduced && !force) return;

      var ticking = false;

      function compute() {
         var vhHalf = window.innerHeight * 0.5;

         all.forEach(function (el) {
            var speed = parseFloat(el.getAttribute('data-parallax-speed') || '0');
            if (!speed) return;

            var rect = el.getBoundingClientRect();
            var delta = rect.top + rect.height * 0.5 - vhHalf;
            var ty = -delta * speed;

            var clamp = parseFloat(el.getAttribute('data-parallax-clamp') || '240');
            var v = Math.max(-clamp, Math.min(clamp, ty));

            if (el.hasAttribute('data-parallax-bg')) {
               // Variante fondo (si se desea en algún elemento puntual)
               el.style.backgroundPosition = '50% calc(50% + ' + v + 'px)';
            } else {
               // Variante transform (recomendada)
               el.style.transform = 'translate3d(0,' + v + 'px,0)';
            }
         });

         ticking = false;
      }

      function onScrollOrResize() {
         if (!ticking) {
            ticking = true;
            requestAnimationFrame(compute);
         }
      }

      compute();
      window.addEventListener('scroll', onScrollOrResize, { passive: true });
      window.addEventListener('resize', onScrollOrResize);
   }

   // ==== INIT AL CARGAR ====
   if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
         initFadeOnce();
         initParallax();
      });
   } else {
      initFadeOnce();
      initParallax();
   }
})();
