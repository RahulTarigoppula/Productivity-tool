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

function Settings() {
  const s = useStore((st) => st.settings);
  const Toggle = ({ k, label, help }: { k: "autoSave" | "wordWrapCode" | "lineNumbers" | "markdownLivePreview"; label: string; help: string }) => (
    <label className="field">
      <span><div className="lbl">{label}</div><div className="help">{help}</div></span>
      <input type="checkbox" checked={s[k]} onChange={(e) => void updateSettings({ [k]: e.target.checked })} />
    </label>
  );
  return (
    <Overlay onClose={closeDialog}>
      <div className="dialog" role="dialog" aria-label="Settings">
        <h3>Settings</h3>
        <label className="field">
          <span><div className="lbl">Theme</div><div className="help">Follow Windows, or choose.</div></span>
          <select className="select" value={s.theme} onChange={(e) => void updateSettings({ theme: e.target.value as typeof s.theme })}>
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label className="field">
          <span><div className="lbl">Density</div><div className="help">How tightly the bars are packed.</div></span>
          <select className="select" value={s.density} onChange={(e) => void updateSettings({ density: e.target.value as typeof s.density })}>
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </select>
        </label>
        <Toggle k="autoSave" label="Auto-save text files" help="Text, Markdown, code and CSV save themselves shortly after you stop typing. PDFs save when you press Ctrl+S." />
        <Toggle k="markdownLivePreview" label="Live Markdown" help="Show headings, bold and links formatted as you type. Turn off to see plain source." />
        <Toggle k="lineNumbers" label="Line numbers in code" help="Shown for code and plain text; Markdown stays clean." />
        <Toggle k="wordWrapCode" label="Wrap long lines in code" help="Markdown always wraps." />
        <label className="field">
          <span><div className="lbl">Editor font size</div></span>
          <select className="select" value={s.fontSize} onChange={(e) => void updateSettings({ fontSize: Number(e.target.value) })}>
            {[12, 13, 14, 15, 16, 18, 20].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label className="field">
          <span><div className="lbl">Tab width</div><div className="help">For new files; existing files keep their own indentation.</div></span>
          <select className="select" value={s.tabSize} onChange={(e) => void updateSettings({ tabSize: Number(e.target.value) })}>
            {[2, 4, 8].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
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
  return (
    <Overlay onClose={closeDialog}>
      <div className="dialog" role="dialog" aria-label="Export">
        <h3>Export {tab.name}</h3>
        <p>The original file is never changed. Labels say how faithful each format is.</p>
        {engineFormats.map((f) => (
          <div key={`engine-${f.ext}`} className={`export-row ${busy && busy !== f.ext ? "unavailable" : ""}`} role="button" tabIndex={0} onClick={() => !busy && void runEngine(f.ext, f.label)} onKeyDown={(e) => e.key === "Enter" && !busy && void runEngine(f.ext, f.label)}>
            <span className="fmt">{f.ext}</span>
            <span className="desc">{f.label}<div className="help">Produced by the Office editor itself, with its full layout.</div></span>
            {busy === f.ext ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <span className={`q ${f.ext === "txt" || f.ext === "csv" ? "text" : "exact"}`}>{f.ext === "txt" || f.ext === "csv" ? QUALITY_LABEL.text : QUALITY_LABEL.exact}</span>}
          </div>
        ))}
        {routes.map((r) => (
          <div key={r.to} className={`export-row ${busy && busy !== r.to ? "unavailable" : ""}`} role="button" tabIndex={0} onClick={() => !busy && void run(r)} onKeyDown={(e) => e.key === "Enter" && !busy && void run(r)}>
            <span className="fmt">{r.to}</span>
            <span className="desc">
              {FORMAT_LABEL[r.to] ?? r.to.toUpperCase()}
              {getRegistry().lossNote(r) && <div className="help">{getRegistry().lossNote(r)}</div>}
            </span>
            {busy === r.to ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <span className={`q ${r.quality}`}>{QUALITY_LABEL[r.quality]}</span>}
          </div>
        ))}
        {printable && (
          <div className="export-row" role="button" tabIndex={0} onClick={() => { closeDialog(); void import("./print").then((m) => m.printActive()); }}>
            <span className="fmt">PDF</span>
            <span className="desc">Print or save as PDF<div className="help">Opens the print dialog; choose "Microsoft Print to PDF" to save a file.</div></span>
            <span className="q good">Good</span>
          </div>
        )}
        {!routes.length && !printable && <p>No export formats are available for this kind of file yet.</p>}
        <div className="help" style={{ marginTop: 12 }}>Word, Excel and PowerPoint as targets, and Markdown ↔ Word, arrive with the conversion pack in a later release.</div>
        <div className="acts"><button className="btn" onClick={closeDialog}>Cancel</button></div>
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
