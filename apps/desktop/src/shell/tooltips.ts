/** Fast, styled tooltips for every icon button. Native `title` tooltips appear late and look out of
 *  place; this takes over any element with a `title` inside the app's own bars, shows the text
 *  after a short pause, and splits "Label (Shortcut)" into a label and a key hint. */

const DELAY = 380;
let tip: HTMLDivElement | null = null;
let timer = 0;
let current: HTMLElement | null = null;
let hiddenAt = 0;

function ensureTip(): HTMLDivElement {
  if (!tip) {
    tip = document.createElement("div");
    tip.className = "tooltip";
    tip.setAttribute("role", "tooltip");
    document.body.appendChild(tip);
  }
  return tip;
}

function hide() {
  window.clearTimeout(timer);
  if (current?.dataset.tip !== undefined) {
    // If the interface set a new title meanwhile, keep that one.
    if (!current.hasAttribute("title")) current.setAttribute("title", current.dataset.tip);
    delete current.dataset.tip;
    if (current.dataset.tipAria !== undefined) {
      current.removeAttribute("aria-label");
      delete current.dataset.tipAria;
    }
  }
  current = null;
  if (tip?.classList.contains("show")) hiddenAt = Date.now();
  tip?.classList.remove("show");
}

function show(el: HTMLElement) {
  const text = el.dataset.tip ?? "";
  if (!text || !el.isConnected) return;
  const t = ensureTip();
  const m = /^(.*)\(([^()]+)\)\s*$/.exec(text);
  t.replaceChildren();
  const label = document.createElement("span");
  label.textContent = m ? m[1].trim() : text;
  t.appendChild(label);
  if (m && /^(Ctrl|Shift|Alt|F\d|Esc|Tab|Enter)/i.test(m[2])) {
    const k = document.createElement("span");
    k.className = "tooltip-key";
    k.textContent = m[2];
    t.appendChild(k);
  }
  t.classList.add("show");
  const r = el.getBoundingClientRect();
  const w = t.offsetWidth;
  const h = t.offsetHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(6, Math.min(left, window.innerWidth - w - 6));
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 6) top = r.top - h - 6;
  t.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
}

export function installTooltips(): () => void {
  if (window.matchMedia("(hover: none)").matches) return () => {};
  const over = (e: MouseEvent) => {
    const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[title], [data-tip]");
    if (el === current) return;
    hide();
    // Only the app's own controls; document content keeps native behaviour.
    if (!el || !el.closest(".tabrow, .toolbar, .statusbar, .side, .side-tabs, .icon-btn, .btn, .pdf-find, .csv-filter")) return;
    if (el.closest(".cm-editor, .docx-host, .pdfViewer")) return;
    const title = el.getAttribute("title");
    if (title) {
      // Keep the accessible name while the native tooltip is suppressed.
      if (!el.hasAttribute("aria-label") && !el.textContent?.trim()) {
        el.setAttribute("aria-label", title.replace(/\s*\([^()]*\)\s*$/, ""));
        el.dataset.tipAria = "";
      }
      el.dataset.tip = title;
      el.removeAttribute("title");
    }
    current = el;
    // Moving along a row of buttons: the next tooltip appears at once.
    timer = window.setTimeout(() => show(el), Date.now() - hiddenAt < 400 ? 0 : DELAY);
  };
  const out = (e: MouseEvent) => {
    if (current && !current.contains(e.relatedTarget as Node | null)) hide();
  };
  const away = () => hide();
  document.addEventListener("mouseover", over, true);
  document.addEventListener("mouseout", out, true);
  document.addEventListener("mousedown", away, true);
  document.addEventListener("keydown", away, true);
  window.addEventListener("blur", away);
  window.addEventListener("scroll", away, true);
  return () => {
    hide();
    document.removeEventListener("mouseover", over, true);
    document.removeEventListener("mouseout", out, true);
    document.removeEventListener("mousedown", away, true);
    document.removeEventListener("keydown", away, true);
    window.removeEventListener("blur", away);
    window.removeEventListener("scroll", away, true);
  };
}
