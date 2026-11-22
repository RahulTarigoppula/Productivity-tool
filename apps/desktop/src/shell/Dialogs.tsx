import { useEffect, useMemo, useState } from "react";
import { NotebookText, FileText, Sheet, FileSearch, FileType, FileSpreadsheet, Presentation } from "lucide-react";
import { useStore, setState, activeTab, handles, toast } from "../app/store";
import { useAsk } from "../app/dialogs";
import { updateSettings, newFile, newOfficeFile, pickAndOpen, suggestExportPath, openPath } from "../app/actions";
import { getRegistry, sourceFormat, FORMAT_LABEL } from "../app/exporters";
import { QUALITY_LABEL, type Route } from "../lib/convert";
import { platform } from "../platform";
import { basename, dirname, join, stem } from "../lib/paths";

const closeDialog = () => setState({ dialog: null });

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", k, true);
    return () => window.removeEventListener("keydown", k, true);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {children}
    </div>
  );
}

export function ConfirmDialog() {
  const req = useAsk();
  if (!req) return null;
  return (
    <Overlay onClose={() => req.resolve(null)}>
      <div className="dialog" role="alertdialog" aria-labelledby="ask-title">
        <h3 id="ask-title">{req.title}</h3>
        <p>{req.body}</p>
        <div className="acts">
          {req.buttons.map((b, i) => (
            <button key={b} autoFocus={i === 0} className={`btn ${i === 0 ? "primary" : ""}`} onClick={() => req.resolve(b)}>
              {b}
            </button>
          ))}
        </div>
      </div>
    </Overlay>
  );
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className={`switch ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}>
      <span className="knob" />
    </button>
  );
}

function Segmented<T extends string | number>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.value)} type="button" role="radio" aria-checked={o.value === value} className={o.value === value ? "on" : ""} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Settings() {
  const s = useStore((st) => st.settings);
  const Row = ({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) => (
    <div className="field">
      <span>
        <div className="lbl">{label}</div>
        {help && <div className="help">{help}</div>}
      </span>
      {children}
    </div>
  );
  const flag = (k: "autoSave" | "wordWrapCode" | "lineNumbers" | "markdownLivePreview", label: string) => (
    <Switch label={label} checked={s[k]} onChange={(v) => void updateSettings({ [k]: v })} />
  );
  return (
    <Overlay onClose={closeDialog}>
      <div className="dialog settings-dialog" role="dialog" aria-label="Settings">
        <h3>Settings</h3>
        <div className="settings-group">
          <div className="group-title">Appearance</div>
          <Row label="Theme" help="Follow Windows, or choose.">
            <Segmented label="Theme" value={s.theme} onChange={(v) => void updateSettings({ theme: v })} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </Row>
          <Row label="Density" help="How tightly the bars are packed.">
            <Segmented label="Density" value={s.density} onChange={(v) => void updateSettings({ density: v })} options={[{ value: "comfortable", label: "Comfortable" }, { value: "compact", label: "Compact" }]} />
          </Row>
        </div>
        <div className="settings-group">
          <div className="group-title">Saving</div>
          <Row label="Auto-save" help="Text, Markdown, code and CSV save themselves a moment after you stop typing. PDFs and Office files save with Ctrl+S.">{flag("autoSave", "Auto-save")}</Row>
        </div>
        <div className="settings-group">
          <div className="group-title">Editor</div>
          <Row label="Live Markdown" help="Headings, bold and links formatted as you type.">{flag("markdownLivePreview", "Live Markdown")}</Row>
          <Row label="Line numbers" help="For code and plain text; Markdown stays clean.">{flag("lineNumbers", "Line numbers")}</Row>
          <Row label="Wrap long lines in code" help="Markdown always wraps.">{flag("wordWrapCode", "Wrap long lines")}</Row>
          <Row label="Font size">
            <Segmented label="Font size" value={s.fontSize} onChange={(v) => void updateSettings({ fontSize: v })} options={[12, 13, 14, 16, 18].map((n) => ({ value: n, label: String(n) }))} />
          </Row>
          <Row label="Tab width" help="For new files; existing files keep their own indentation.">
            <Segmented label="Tab width" value={s.tabSize} onChange={(v) => void updateSettings({ tabSize: v })} options={[2, 4, 8].map((n) => ({ value: n, label: String(n) }))} />
          </Row>
        </div>
        <div className="acts"><button className="btn primary" onClick={closeDialog}>Done</button></div>
      </div>
    </Overlay>
  );
}

function useOfficeAvailable() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    void platform.officePack().then((p) => setOk(p.available)).catch(() => setOk(false));
  }, []);
  return ok;
}

function NewFile() {
  const pick = (f: () => void) => { closeDialog(); f(); };
  const office = useOfficeAvailable();
  return (
    <Overlay onClose={closeDialog}>
      <div className="dialog" role="dialog" aria-label="New file">
        <h3>New</h3>
        <div className="tiles" style={{ marginTop: 12 }}>
          <button className="tile" autoFocus onClick={() => pick(() => newFile("markdown"))}><NotebookText style={{ color: "var(--k-markdown)" }} /><span className="t">Markdown note</span></button>
          <button className="tile" onClick={() => pick(() => newFile("text"))}><FileText style={{ color: "var(--k-text)" }} /><span className="t">Text or code</span></button>
          <button className="tile" onClick={() => pick(() => newFile("csv"))}><Sheet style={{ color: "var(--k-csv)" }} /><span className="t">CSV table</span></button>
          {office && <button className="tile" onClick={() => pick(() => void newOfficeFile("docx"))}><FileType style={{ color: "var(--k-docx)" }} /><span className="t">Word document</span></button>}
          {office && <button className="tile" onClick={() => pick(() => void newOfficeFile("xlsx"))}><FileSpreadsheet style={{ color: "var(--k-xlsx)" }} /><span className="t">Spreadsheet</span></button>}
          {office && <button className="tile" onClick={() => pick(() => void newOfficeFile("pptx"))}><Presentation style={{ color: "var(--k-pptx)" }} /><span className="t">Presentation</span></button>}
          <button className="tile" onClick={() => pick(() => void pickAndOpen())}><FileSearch style={{ color: "var(--accent)" }} /><span className="t">Open file…</span></button>
        </div>
        {!office && <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12 }}>Word, Excel and PowerPoint editing comes with the installer (the Office pack). Without it, those files open as read-only previews.</p>}
      </div>
    </Overlay>
  );
}

function About() {
  return (
    <Overlay onClose={closeDialog}>
      <div className="dialog" role="dialog" aria-label="About">
        <h3>Productivity 0.1</h3>
        <p>One calm app for every kind of file. Local only: no account, no cloud, no tracking.</p>
        <p style={{ fontSize: 12 }}>
          Edits text, code, Markdown and CSV; views, annotates, signs and reorganises PDFs; and edits Word, Excel and PowerPoint files with the embedded Euro-Office editors (based on ONLYOFFICE, AGPL-3.0) when the Office pack is installed. Open-source components: Tauri, React, CodeMirror, PDF.js, pdf-lib, Euro-Office / ONLYOFFICE, docx-preview, JSZip, marked, DOMPurify, cmdk, Lucide.
        </p>
        <div className="acts"><button className="btn primary" onClick={closeDialog}>Close</button></div>
      </div>
    </Overlay>
  );
}

function Export() {
  const tab = activeTab();
  const [busy, setBusy] = useState<string | null>(null);
  const engineFormats = tab ? handles.get(tab.id)?.exportFormats?.() ?? [] : [];
  const routes = useMemo<Route[]>(() => {
    if (!tab) return [];
    // Formats the open engine produces itself take priority over the shared converters.
    const own = new Set((handles.get(tab.id)?.exportFormats?.() ?? []).map((f) => f.ext));
    return getRegistry().routes(sourceFormat(tab.name, tab.kind)).filter((r) => !own.has(r.to));
  }, [tab]);
  if (!tab) return null;
  const runEngine = async (ext: string, label: string) => {
    const handle = handles.get(tab.id);
    if (!handle?.convert) return;
    const target = await platform.pickSave({ defaultPath: suggestExportPath(tab, ext), filters: [{ name: label, extensions: [ext] }] });
    if (!target) return;
    setBusy(ext);
    try {
      const bytes = await handle.convert(ext);
      await platform.writeFile(target, bytes);
      closeDialog();
      toast(`Exported ${basename(target)}`, "info", { label: "Open", run: () => void openPath(target) });
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setBusy(null);
    }
  };
  const run = async (route: Route) => {
    const handle = handles.get(tab.id);
    if (!handle) return;
    const loss = getRegistry().lossNote(route);
    const target = await platform.pickSave({ defaultPath: suggestExportPath(tab, route.to), filters: [{ name: FORMAT_LABEL[route.to] ?? route.to.toUpperCase(), extensions: [route.to] }] });
    if (!target) return;
    setBusy(route.to);
    try {
      const bytes = await handle.serialize();
      const out = await getRegistry().run(route, { bytes, name: tab.name });
      const written: string[] = [];
      for (const f of out.files) {
        const p = f.suffix ? join(dirname(target), `${stem(target)}${f.suffix}.${route.to}`) : target;
        await platform.writeFile(p, f.bytes);
        written.push(p);
      }
      closeDialog();
      toast(written.length > 1 ? `Exported ${written.length} files${loss ? " — " + loss : ""}` : `Exported ${basename(written[0])}`, "info", {
        label: written.length > 1 && platform.folders ? "Show in folder" : "Open",
        run: () => (written.length > 1 && platform.folders ? void platform.reveal(written[0]) : void openPath(written[0])),
      });
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setBusy(null);
    }
  };
  const printable = tab.kind !== "binary";
  const row = (key: string, ext: string, title: string, sub: string | null, quality: keyof typeof QUALITY_LABEL, onRun: () => void) => (
    <button key={key} type="button" className={`export-row ${busy && busy !== key ? "unavailable" : ""}`} disabled={!!busy && busy !== key} onClick={() => !busy && onRun()}>
      <span className={`fmt-badge fmt-${ext}`}>{ext}</span>
      <span className="desc">
        <span className="t">{title}</span>
        {sub && <span className="help">{sub}</span>}
      </span>
      {busy === key ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <span className={`q ${quality}`}>{QUALITY_LABEL[quality]}</span>}
    </button>
  );
  return (
    <Overlay onClose={closeDialog}>
      <div className="dialog export-dialog" role="dialog" aria-label="Export">
        <h3>Export</h3>
        <p className="dialog-sub">
          <span className="file-chip">{tab.name}</span> stays as it is; a new file is written.
        </p>
        <div className="export-list">
          {engineFormats.map((f) =>
            row(f.ext, f.ext, f.label, "Full layout, made by the Office editor", f.ext === "txt" || f.ext === "csv" ? "text" : "exact", () => void runEngine(f.ext, f.label)),
          )}
          {routes.map((r) => row(r.to, r.to, FORMAT_LABEL[r.to] ?? r.to.toUpperCase(), getRegistry().lossNote(r), r.quality, () => void run(r)))}
          {printable &&
            row("print", "print", "Print…", platform.folders ? "Or save as PDF with \u201cMicrosoft Print to PDF\u201d" : "Or save as PDF from the print dialog", "good", () => {
              closeDialog();
              void import("./print").then((m) => m.printActive());
            })}
        </div>
        {!routes.length && !printable && !engineFormats.length && <p>No export formats are available for this kind of file yet.</p>}
        <div className="dialog-foot">
          <span className="help">Labels show how much of the document each format keeps.</span>
          <button className="btn" onClick={closeDialog}>Cancel</button>
        </div>
      </div>
    </Overlay>
  );
}

export function Dialogs() {
  const d = useStore((s) => s.dialog);
  return (
    <>
      {d?.kind === "settings" && <Settings />}
      {d?.kind === "newFile" && <NewFile />}
      {d?.kind === "about" && <About />}
      {d?.kind === "export" && <Export />}
      <ConfirmDialog />
    </>
  );
}

export function Toasts() {
  const toasts = useStore((s) => s.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span>{t.text}</span>
          {t.action && <button onClick={() => { setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) })); t.action!.run(); }}>{t.action.label}</button>}
        </div>
      ))}
    </div>
  );
}
