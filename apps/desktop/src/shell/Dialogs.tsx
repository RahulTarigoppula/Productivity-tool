import { useEffect, useMemo, useRef, useState } from "react";
import { useModalFocus } from "./modalFocus";
import { NotebookText, FileText, Sheet, FileSearch, FileType, FileSpreadsheet, Presentation } from "lucide-react";
import { useStore, setState, activeTab, handles, toast } from "../app/store";
import { useAsk } from "../app/dialogs";
import { updateSettings, newFile, newOfficeFile, pickAndOpen, suggestExportPath, openPath, handleExternalChange, addRecent } from "../app/actions";
import { getRegistry, sourceFormat, FORMAT_LABEL, PREFERRED_EXPORTS } from "../app/exporters";
import { kindFromName } from "../lib/formats";
import { QUALITY_LABEL, type Route } from "../lib/convert";
import { platform } from "../platform";
import { basename, dirname, join, stem } from "../lib/paths";

const closeDialog = () => setState({ dialog: null });

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useModalFocus(ref, onClose);
  return (
    <div className="overlay" ref={ref} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
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
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          // One stop for Tab (the chosen option); arrow keys move between options.
          tabIndex={o.value === value ? 0 : -1}
          className={o.value === value ? "on" : ""}
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            const i = options.findIndex((x) => x.value === value);
            const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
            if (!d) return;
            e.preventDefault();
            const next = options[(i + d + options.length) % options.length];
            onChange(next.value);
            const group = e.currentTarget.parentElement;
            requestAnimationFrame(() => group?.querySelector<HTMLElement>("[aria-checked=true]")?.focus());
          }}
        >
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
          <Row label="Theme" help="Match this device, or choose.">
            <Segmented label="Theme" value={s.theme} onChange={(v) => void updateSettings({ theme: v })} options={[{ value: "system", label: "System" }, { value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} />
          </Row>
        </div>
        <div className="settings-group">
          <div className="group-title">Saving</div>
          <Row label="Auto-save" help="Text, Markdown, code and CSV save themselves a moment after you stop typing. PDFs and Office files save when you choose Save.">{flag("autoSave", "Auto-save")}</Row>
        </div>
        <div className="settings-group">
          <div className="group-title">Editor</div>
          <Row label="Format notes as I type" help="Headings, bold, lists and links look formatted while you write.">{flag("markdownLivePreview", "Format notes as I type")}</Row>
          <Row label="Text size">
            <Segmented
              label="Text size"
              value={[13, 14, 16, 18].includes(s.fontSize) ? s.fontSize : s.fontSize < 14 ? 13 : s.fontSize < 16 ? 14 : s.fontSize < 18 ? 16 : 18}
              onChange={(v) => void updateSettings({ fontSize: v })}
              options={[{ value: 13, label: "Small" }, { value: 14, label: "Medium" }, { value: 16, label: "Large" }, { value: 18, label: "Larger" }]}
            />
          </Row>
          <Row label="Line numbers in code" help="Notes stay clean either way.">{flag("lineNumbers", "Line numbers in code")}</Row>
          <Row label="Wrap long lines in code" help="Notes always wrap.">{flag("wordWrapCode", "Wrap long lines in code")}</Row>
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
  // The same names and look as the home screen's Create cards.
  const items: { kind: string; label: string; hint: string; icon: React.ReactNode; run: () => void }[] = [
    { kind: "markdown", label: "Note", hint: "Markdown", icon: <NotebookText />, run: () => newFile("markdown") },
    { kind: "text", label: "Text or code", hint: "Any language", icon: <FileText />, run: () => newFile("text") },
    { kind: "csv", label: "Table", hint: "CSV", icon: <Sheet />, run: () => newFile("csv") },
    ...(office
      ? [
          { kind: "docx", label: "Document", hint: "Word", icon: <FileType />, run: () => void newOfficeFile("docx") },
          { kind: "xlsx", label: "Spreadsheet", hint: "Excel", icon: <FileSpreadsheet />, run: () => void newOfficeFile("xlsx") },
          { kind: "pptx", label: "Presentation", hint: "PowerPoint", icon: <Presentation />, run: () => void newOfficeFile("pptx") },
        ]
      : []),
  ];
  return (
    <Overlay onClose={closeDialog}>
      <div className="dialog new-dialog" role="dialog" aria-label="New file">
        <h3>Create</h3>
        <div className="create-grid" style={{ marginTop: 12 }}>
          {items.map((c, i) => (
            <button key={c.kind} className={`create-card k-${c.kind}`} autoFocus={i === 0} onClick={() => pick(c.run)}>
              <span className="chip">{c.icon}</span>
              <span className="t">{c.label}</span>
              <span className="d">{c.hint}</span>
            </button>
          ))}
        </div>
        <div className="dialog-foot">
          <button className="btn subtle" onClick={() => pick(() => void pickAndOpen())}><FileSearch /> Open a file instead</button>
          <button className="btn" onClick={closeDialog}>Cancel</button>
        </div>
      </div>
    </Overlay>
  );
}

function About() {
  const [licenses, setLicenses] = useState(false);
  return (
    <Overlay onClose={closeDialog}>
      <div className="dialog" role="dialog" aria-label="About">
        <h3>Productivity 0.1</h3>
        <p>One calm app for notes, tables, PDFs, documents and code. Everything stays on this device: no account, no cloud, no tracking.</p>
        {licenses ? (
          <p className="help" style={{ lineHeight: 1.6 }}>
            Built with open-source software: Tauri, React, CodeMirror, PDF.js, pdf-lib, docx-preview, JSZip, marked, DOMPurify, cmdk and Lucide icons. Word, Excel and PowerPoint editing, where installed, uses the Euro-Office editors, based on ONLYOFFICE (AGPL-3.0); their source and licence come with the app.
          </p>
        ) : (
          <button className="btn subtle" style={{ paddingLeft: 0 }} onClick={() => setLicenses(true)}>Open-source licences</button>
        )}
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
  // The document's text, read once and only if a note depends on it.
  const textCache = useRef<string | null>(null);
  if (!tab || tab.error) return null;
  const sourceText = () => (textCache.current ??= handles.get(tab.id)?.getText?.() ?? "");
  /** "Exported plan.docx to Documents", and the file joins Recent so it is easy to find again. */
  const exported = (paths: string[], loss: string | null) => {
    for (const p of paths) void addRecent(p, kindFromName(p));
    const folder = basename(dirname(paths[0]));
    const where = folder ? ` to ${folder}` : "";
    toast(paths.length > 1 ? `Exported ${paths.length} files${where}${loss ? " — " + loss : ""}` : `Exported ${basename(paths[0])}${where}`, "info", {
      label: paths.length > 1 && platform.folders ? "Show in folder" : "Open",
      run: () => (paths.length > 1 && platform.folders ? void platform.reveal(paths[0]) : void openPath(paths[0])),
    });
  };
  const runEngine = async (ext: string, label: string) => {
    const handle = handles.get(tab.id);
    if (!handle?.convert) return;
    const target = await platform.pickSave({ defaultPath: suggestExportPath(tab, ext), filters: [{ name: label, extensions: [ext] }] });
    if (!target) return;
    setBusy(ext);
    try {
      const bytes = await handle.convert(ext);
      // Exporting over an existing file keeps its previous version, and an open tab of it refreshes.
      await platform.writeFile(target, bytes, { snapshot: true });
      handleExternalChange(target);
      closeDialog();
      exported([target], null);
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setBusy(null);
    }
  };
  const run = async (route: Route) => {
    const handle = handles.get(tab.id);
    if (!handle) return;
    const loss = getRegistry().lossNote(route, sourceText);
    const target = await platform.pickSave({ defaultPath: suggestExportPath(tab, route.to), filters: [{ name: FORMAT_LABEL[route.to] ?? route.to.toUpperCase(), extensions: [route.to] }] });
    if (!target) return;
    setBusy(route.to);
    try {
      const bytes = await handle.serialize();
      const out = await getRegistry().run(route, { bytes, name: tab.name, hints: handle.exportHints?.() });
      const written: string[] = [];
      for (const f of out.files) {
        const p = f.suffix ? join(dirname(target), `${stem(target)}${f.suffix}.${route.to}`) : target;
        await platform.writeFile(p, f.bytes, { snapshot: true });
        handleExternalChange(p);
        written.push(p);
      }
      closeDialog();
      exported(written, loss);
    } catch (e) {
      toast(`Export failed: ${e instanceof Error ? e.message : e}`, "error");
    } finally {
      setBusy(null);
    }
  };
  const printable = tab.kind !== "binary" && tab.kind !== "media" && tab.kind !== "archive";
  const row = (key: string, ext: string, title: string, sub: string | null, quality: keyof typeof QUALITY_LABEL, onRun: () => void) => (
    <button key={key} type="button" className={`export-row ${busy && busy !== key ? "unavailable" : ""}`} disabled={!!busy && busy !== key} onClick={() => !busy && onRun()}>
      <span className={`fmt-badge fmt-${ext}`}>{ext}</span>
      <span className="desc">
        <span className="t">{title}</span>
        {sub && <span className="help">{sub}</span>}
      </span>
      {/* A label only where something is lost; full-quality formats need no badge. */}
      {busy === key ? <span className="spinner" style={{ width: 16, height: 16 }} /> : quality === "text" ? <span className={`q ${quality}`}>{QUALITY_LABEL[quality]}</span> : null}
    </button>
  );
  // What people usually want from this kind of file comes first; the rest wait under "More formats".
  const items = [
    ...routes.map((r) => ({ key: r.to, quality: r.quality, node: row(r.to, r.to, FORMAT_LABEL[r.to] ?? r.to.toUpperCase(), getRegistry().lossNote(r, sourceText), r.quality, () => void run(r)) })),
    ...(printable
      ? [{
          key: "print",
          quality: "good" as const,
          node: row("print", "print", "Print or save as a formatted PDF…", "Choose \u201cSave as PDF\u201d (or a PDF printer) in the print window", "good", () => {
            closeDialog();
            void import("./print").then((m) => m.printActive());
          }),
        }]
      : []),
  ];
  const preferred = PREFERRED_EXPORTS[sourceFormat(tab.name, tab.kind)];
  const top = preferred ? preferred.flatMap((k) => items.filter((x) => x.key === k)) : items;
  const more = preferred ? items.filter((x) => !preferred.includes(x.key)) : [];
  const anyTextOnly = top.some((x) => x.quality === "text") || (more.length > 0 && more.some((x) => x.quality === "text"));
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
          {top.map((x) => x.node)}
          {more.length > 0 && (
            <details className="export-more">
              <summary>More formats</summary>
              <div className="export-list">{more.map((x) => x.node)}</div>
            </details>
          )}
        </div>
        {!routes.length && !printable && !engineFormats.length && <p>No export formats are available for this kind of file yet.</p>}
        <div className="dialog-foot">
          {anyTextOnly && <span className="help">“Text only” means formatting is not kept.</span>}
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
          <button className="toast-close" aria-label="Dismiss" onClick={() => setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }))}>×</button>
        </div>
      ))}
    </div>
  );
}
