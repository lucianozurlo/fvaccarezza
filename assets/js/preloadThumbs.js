function preloadThumbs({
  baseUrl,
  from = 1,
  to = 59,
  concurrency = 6,
  timeoutMs = 15000,
  onProgress = null, // (loaded, total, url) => void
} = {}) {
  const pad2 = (n) => String(n).padStart(2, "0");
  const urls = [];

  for (let i = from; i <= to; i++) {
    urls.push(`${baseUrl}${pad2(i)}_th.jpg`);
  }

  let idx = 0;
  let active = 0;
  let loaded = 0;
  const total = urls.length;

  return new Promise((resolve) => {
    const pump = () => {
      while (active < concurrency && idx < total) {
        const url = urls[idx++];
        active++;

        const img = new Image();
        img.decoding = "async";

        let done = false;

        const finish = () => {
          if (done) return;
          done = true;
          active--;
          loaded++;
          if (onProgress) onProgress(loaded, total, url);
          if (loaded >= total) resolve();
          else pump();
        };

        // timeout por si alguna imagen no responde
        const t = setTimeout(finish, timeoutMs);

        img.onload = () => {
          clearTimeout(t);
          finish();
        };
        img.onerror = () => {
          clearTimeout(t);
          finish();
        };

        // dispara la carga
        img.src = url;
      }
    };

    pump();
  });
}
