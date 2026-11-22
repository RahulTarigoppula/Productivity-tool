import { useEffect, useRef, useState } from "react";
import { Info, ExternalLink, Share, ZoomIn, ZoomOut } from "lucide-react";
import type { EngineHost } from "../../app/editor-api";
import { readXlsx, readPptx, colName, type SheetData, type SlideText } from "./ooxml";
import { platform } from "../../platform";
import { setState } from "../../app/store";

const MAX_ROWS = 5000;

function Notice({ host }: { host: EngineHost }) {
  return (
    <div className="banner">
      <Info />
      <span className="msg">Read-only preview. Full Word, Excel and PowerPoint editing arrives with the Office engine in the next release.</span>
      {host.path && <button className="btn" onClick={() => void platform.openExternal(host.path!)}><ExternalLink size={14} /> Open in default app</button>}
      <button className="btn" onClick={() => setState({ dialog: { kind: "export" } })}><Share size={14} /> Export</button>
    </div>
  );
}

function DocxView({ bytes, zoom, onLink }: { bytes: Uint8Array; zoom: number; onLink: (href: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void import("docx-preview").then(async ({ renderAsync }) => {
      if (!ref.current || !live) return;
      ref.current.innerHTML = "";
      try {
        await renderAsync(new Blob([bytes.slice()]), ref.current, undefined, {
          inWrapper: true, ignoreLastRenderedPageBreak: false, breakPages: true, renderHeaders: true, renderFooters: true, renderFootnotes: true, useBase64URL: true,
          // Embedded HTML chunks would render in a same-origin frame; never allow them.
          renderAltChunks: false,
        });
        // Strip anything that could load remote content or navigate the window.
        ref.current.querySelectorAll("iframe, object, embed, form, base, meta, link, script").forEach((el) => el.remove());
        ref.current.querySelectorAll("img").forEach((img) => {
          if (!/^(data:|blob:)/i.test(img.getAttribute("src") ?? "")) img.remove();
        });
      } catch (e) {
        if (live) setErr(e instanceof Error ? e.message : String(e));
      }
    });
    return () => {
      live = false;
    };
  }, [bytes]);
  if (err) return <div className="center-note"><h3>Preview failed</h3><div>{err}</div></div>;
  return (
    <div
      className="docx-host"
      data-links="app"
      style={{ zoom }}
      ref={ref}
      onClickCapture={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (!a) return;
        e.preventDefault();
        e.stopPropagation();
        const href = a.getAttribute("href") ?? "";
        if (href.startsWith("#")) {
          const target = ref.current?.querySelector(`[id="${CSS.escape(href.slice(1))}"], a[name="${CSS.escape(href.slice(1))}"]`);
          target?.scrollIntoView({ block: "start" });
        } else onLink(href);
      }}
    />
  );
}

function XlsxView({ sheets }: { sheets: SheetData[] }) {
  const [i, setI] = useState(0);
  const [cell, setCell] = useState<{ r: number; c: number } | null>(null);
  const s = sheets[i];
  if (!s) return <div className="center-note">This workbook has no sheets.</div>;
  const ref = cell ? `${colName(cell.c)}${cell.r + 1}` : "";
  const formula = cell ? s.formulas.get(ref) : undefined;
  return (
    <div className="xlsx">
      <div className="xlsx-bar">
        <span className="ref">{ref || " "}</span>
        <span className="val">{cell ? (formula ? `=${formula}` : s.rows[cell.r]?.[cell.c] ?? "") : ""}</span>
      </div>
      <div className="xlsx-scroll">
        <table className="xlsx-table">
          <thead>
            <tr>
              <th />
              {Array.from({ length: s.maxCol }, (_, c) => <th key={c}>{colName(c)}</th>)}
            </tr>
          </thead>
          <tbody>
            {s.rows.slice(0, MAX_ROWS).map((row, r) => (
              <tr key={r}>
                <th>{r + 1}</th>
                {row.map((v, c) => (
                  <td key={c} className={`${cell?.r === r && cell?.c === c ? "cur" : ""} ${v && !isNaN(Number(v)) ? "num" : ""}`} onClick={() => setCell({ r, c })} title={s.formulas.get(`${colName(c)}${r + 1}`) ? `=${s.formulas.get(`${colName(c)}${r + 1}`)}` : undefined}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {s.rows.length > MAX_ROWS && <div className="empty-note">Showing the first {MAX_ROWS.toLocaleString()} of {s.rows.length.toLocaleString()} rows.</div>}
        {s.truncated && <div className="empty-note">This sheet is larger than the preview limits; some cells are not shown.</div>}
      </div>
      <div className="xlsx-tabs" role="tablist">
        {sheets.map((sh, k) => (
          <button key={k} role="tab" aria-selected={k === i} className={`icon-btn ${k === i ? "active" : ""}`} onClick={() => { setI(k); setCell(null); }}>{sh.name}</button>
        ))}
      </div>
    </div>
  );
}

function PptxView({ slides }: { slides: SlideText[] }) {
  return (
    <div className="pptx">
      {slides.map((s) => (
        <section key={s.index} className="slide-card" aria-label={`Slide ${s.index}`}>
          <div className="slide-num">{s.index}</div>
          <div className="slide-body">
            {s.paragraphs.length ? s.paragraphs.map((p, i) => <div key={i} className={i === 0 ? "slide-title" : "slide-p"}>{p}</div>) : <div className="slide-p muted">No text on this slide</div>}
            {s.notes.length > 0 && <div className="slide-notes">Notes: {s.notes.join(" ")}</div>}
          </div>
        </section>
      ))}
      {!slides.length && <div className="center-note">This presentation has no slides.</div>}
    </div>
  );
}

export default function OfficeEngine({ host }: { host: EngineHost }) {
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [slides, setSlides] = useState<SlideText[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (host.kind === "xlsx") readXlsx(host.bytes).then(setSheets).catch((e) => setErr(String(e?.message ?? e)));
    if (host.kind === "pptx") readPptx(host.bytes).then(setSlides).catch((e) => setErr(String(e?.message ?? e)));
  }, [host]);

  useEffect(() => {
    const text = () =>
      host.kind === "xlsx" ? (sheets ?? []).map((s) => `${s.name}\n${s.rows.map((r) => r.join("\t")).join("\n")}`).join("\n\n")
      : host.kind === "pptx" ? (slides ?? []).map((s) => `Slide ${s.index}\n${s.paragraphs.join("\n")}`).join("\n\n")
      : "";
    host.register({
      canSave: false,
      serialize: async () => host.bytes,
      focus: () => {},
      zoom: (d) => setZoom((z) => (d === 0 ? 1 : Math.max(0.5, Math.min(2.5, z + d * 0.1)))),
      getText: text,
    });
    const label = { docx: "Word document", xlsx: "Excel workbook", pptx: "PowerPoint presentation" }[host.kind as "docx"];
    host.setStatus([
      { id: "kind", text: `${label} · read-only preview` },
      ...(sheets ? [{ id: "sheets", text: `${sheets.length} sheet${sheets.length === 1 ? "" : "s"}` }] : []),
      ...(slides ? [{ id: "slides", text: `${slides.length} slide${slides.length === 1 ? "" : "s"}` }] : []),
    ]);
    host.setToolbar(
      host.kind === "docx"
        ? [
            { id: "zout", label: "Zoom out", icon: <ZoomOut />, run: () => setZoom((z) => Math.max(0.5, z - 0.1)), group: "z" },
            { id: "zin", label: "Zoom in", icon: <ZoomIn />, run: () => setZoom((z) => Math.min(2.5, z + 0.1)), group: "z" },
          ]
        : [],
    );
  }, [host, sheets, slides]);

  return (
    <div className="office">
      <Notice host={host} />
      <div className="office-body">
        {err ? (
          <div className="center-note"><h3>This file could not be previewed</h3><div>{err}</div></div>
        ) : host.kind === "docx" ? (
          <DocxView bytes={host.bytes} zoom={zoom} onLink={(href) => host.openLink(href)} />
        ) : host.kind === "xlsx" ? (
          sheets ? <XlsxView sheets={sheets} /> : <div className="center-note"><div className="spinner" /></div>
        ) : slides ? (
          <PptxView slides={slides} />
        ) : (
          <div className="center-note"><div className="spinner" /></div>
        )}
      </div>
    </div>
  );
}
