(function () {
  const mode = sessionStorage.getItem("vt_mode");
  const dir = sessionStorage.getItem("vt_dir");
  if (mode) document.documentElement.dataset.vtMode = mode;
  if (dir) document.documentElement.dataset.vtDir = dir;
  sessionStorage.removeItem("vt_mode");
  sessionStorage.removeItem("vt_dir");
})();
