window.addEventListener("load", () => {
  const run = () =>
    preloadThumbs({
      baseUrl: "./work/photography/photos/th/",
      from: 1,
      to: 59,
      concurrency: 6,
      onProgress: (l, t) => console.log(`Preload thumbs: ${l}/${t}`),
    });

  if ("requestIdleCallback" in window)
    requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 400);
});
