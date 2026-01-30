(function ($) {
  var $wrap = $("#gallery");
  if (!$wrap.length) return;

  function initIsotope() {
    $wrap.isotope({
      itemSelector: ".tt-grid-item",
      percentPosition: true,
      masonry: {
        columnWidth: ".grid-sizer",
        gutter: ".gutter-sizer",
      },
    });
  }

  if ($.fn.imagesLoaded) {
    $wrap.imagesLoaded(function () {
      initIsotope();
      $wrap.isotope("layout");
    });
  } else {
    initIsotope();
    $(window).on("load", function () {
      $wrap.isotope("layout");
    });
  }

  var resizeTimer = null;
  $(window).on("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if ($wrap.data("isotope")) $wrap.isotope("layout");
    }, 120);
  });
})(jQuery);
