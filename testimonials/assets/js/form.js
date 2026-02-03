(function () {
  const form = document.querySelector(".form-wrap");
  if (!form) return;

  // status UI
  let statusEl = document.getElementById("form-status");
  if (!statusEl) {
    statusEl = document.createElement("div");
    statusEl.id = "form-status";
    statusEl.className = "hint";
    const actions = form.querySelector(".actions");
    actions.parentNode.insertBefore(statusEl, actions.nextSibling);
  }
  const setStatus = (t, type) => {
    statusEl.textContent = t;
    statusEl.dataset.type = type || "";
  };

  // ---- MULTISELECT: recoger TODOS los seleccionados
  const chips = form.querySelectorAll('.chips-group input[type="checkbox"]');
  const getProjectTypes = () =>
    Array.from(chips)
      .filter((x) => x.checked)
      .map((x) => x.value);

  // Accesibilidad visual de error en el grupo
  const group = form.querySelector("#project-type-group");
  const setGroupValidity = (ok) => {
    if (!group) return;
    group.setAttribute("aria-invalid", ok ? "false" : "true");
  };

  // endpoints: Netlify → PHP
  const ENDPOINTS = ["/.netlify/functions/contact", "/contact.php"];

  async function send(payload) {
    let lastErr;
    for (const url of ENDPOINTS) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await r.json().catch(() => ({}));
        if (r.ok && data.ok) return data;
        lastErr = new Error(data.error || `Failure in ${url}`);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("The message could not be sent.");
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('.btn[type="submit"]');

    const payload = {
      name: form.querySelector("#name")?.value?.trim() || "",
      email: form.querySelector("#email")?.value?.trim() || "",
      project_type: getProjectTypes(), // <-- ahora es un ARRAY
      project_description: form.querySelector("#desc")?.value?.trim() || "",
    };

    // Validación: al menos un tipo seleccionado
    if (!payload.name || !payload.email || payload.project_type.length === 0) {
      setStatus("Complete Name, Email and at least one Project type.", "err");
      setGroupValidity(false);
      return;
    }
    setGroupValidity(true);

    btn.disabled = true;
    btn.style.opacity = "0.7";
    setStatus("Sending…", "neutral");

    try {
      await send(payload);
      setStatus("Message sent successfully!", "ok");
      form.reset();
    } catch (e) {
      setStatus(e.message || "Error sending message.", "err");
    } finally {
      btn.disabled = false;
      btn.style.opacity = "1";
    }
  });
})();
