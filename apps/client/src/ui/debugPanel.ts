// Panel de debug (F1 o tecla º): ajusta en vivo las constantes numéricas de un objeto de tuning.

type Tunable = Record<string, number>;

export function createDebugPanel(sections: Record<string, Tunable>) {
  const defaults = Object.fromEntries(Object.entries(sections).map(([k, v]) => [k, { ...v }]));
  const panel = document.createElement("div");
  panel.id = "debug";
  panel.hidden = true;
  document.body.append(panel);

  const render = () => {
    panel.replaceChildren();
    const title = document.createElement("div");
    title.className = "debug-title";
    title.textContent = "Tuning (F1 para cerrar)";
    const reset = document.createElement("button");
    reset.textContent = "Restablecer";
    reset.onclick = () => {
      for (const [k, v] of Object.entries(defaults)) Object.assign(sections[k]!, v);
      render();
    };
    title.append(reset);
    panel.append(title);

    for (const [name, obj] of Object.entries(sections)) {
      const h = document.createElement("div");
      h.className = "debug-section";
      h.textContent = name;
      panel.append(h);
      for (const key of Object.keys(obj)) {
        const def = defaults[name]![key]!;
        const row = document.createElement("label");
        const span = document.createElement("span");
        span.textContent = key;
        const input = document.createElement("input");
        input.type = "range";
        input.min = "0";
        input.max = String(def === 0 ? 1 : def * 3);
        input.step = String(def === 0 ? 0.01 : def / 100);
        input.value = String(obj[key]);
        const out = document.createElement("output");
        out.textContent = obj[key]!.toFixed(2);
        input.oninput = () => {
          obj[key] = Number(input.value);
          out.textContent = obj[key]!.toFixed(2);
        };
        row.append(span, input, out);
        panel.append(row);
      }
    }
  };
  render();

  window.addEventListener("keydown", (e) => {
    if (e.code === "F1" || e.code === "Backquote") {
      e.preventDefault();
      panel.hidden = !panel.hidden;
    }
  });
}
