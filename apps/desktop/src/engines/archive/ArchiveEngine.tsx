import { useEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Download, FolderOutput } from "lucide-react";
import JSZip from "jszip";
import type { EngineHost } from "../../app/editor-api";
import { readPartBytes } from "../office/ooxml";
import { openBytes } from "../../app/actions";
import { platform } from "../../platform";
import { basename, join, stem } from "../../lib/paths";
import { KindIcon } from "../../shell/icons";
import { ErrorState } from "../../shell/ErrorState";
import { kindFromName } from "../../lib/formats";

/** Files larger than this are not opened from an archive (the same limit as opening from disk). */
const MAX_ENTRY = 300 * 1024 * 1024;
/** Archives that would unpack to more than this are not extracted in one go. */
const MAX_TOTAL = 4 * 1024 * 1024 * 1024;
const EXTRACT = "\u0000extract";
/** Each row's height, and where the list starts below the column names (see app.css). */
const ROW_H = 38;
const LIST_TOP = 46;

interface Entry {
  path: string;
  size: number;
  date: Date;
}

const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

/** A ZIP archive: what is inside, and any file in it opened in its own tab or saved on its own.
 *  Nothing is unpacked until it is asked for; the archive itself is never changed. */
export default function ArchiveEngine({ host }: { host: EngineHost }) {
  const [zip, setZip] = useState<JSZip | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, height: 800 });
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setView({ top: el.scrollTop - LIST_TOP, height: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [zip]);

  useEffect(() => {
    let live = true;
    // Only the list is read here; each file is unpacked (with a hard size limit) when asked for,
    // so a large archive opens however much it would unpack to.
    JSZip.loadAsync(host.bytes)
      .then((z) => live && setZip(z))
      .catch((e) => live && setErr(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [host]);

  const entries = useMemo<Entry[]>(() => {
    if (!zip) return [];
    const out: Entry[] = [];
    zip.forEach((path, f) => {
      if (f.dir) return;
      const size = (f as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
      out.push({ path, size, date: f.date });
    });
    return out.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: "base" }));
  }, [zip]);

  const total = entries.reduce((n, e) => n + e.size, 0);

  useEffect(() => {
    host.register({ canSave: false, serialize: async () => host.bytes, focus: () => document.querySelector<HTMLElement>(".archive-list button")?.focus() });
    host.setToolbar(
      zip && entries.length && platform.folders
        ? [{ id: "extract", label: "Extract all files to a folder…", text: busy === EXTRACT ? "Extracting…" : "Extract all", icon: <FolderOutput />, group: "x", disabled: !!busy, run: () => void extractAllRef.current() }]
        : [],
    );
    host.setStatus(zip ? [{ id: "count", text: progress ?? `${entries.length.toLocaleString()} ${entries.length === 1 ? "file" : "files"} · ${sizeText(total)} unpacked` }] : []);
  }, [host, zip, entries.length, total, busy, progress]);

  const read = async (e: Entry): Promise<Uint8Array | null> => {
    if (e.size > MAX_ENTRY) {
      host.toast(`${basename(e.path)} is too large to open from the archive.`, "error");
      return null;
    }
    setBusy(e.path);
    try {
      return (await readPartBytes(zip!, e.path, MAX_ENTRY)) ?? new Uint8Array();
    } catch (x) {
      // Encrypted entries and damaged data end up here.
      host.toast(`${basename(e.path)} could not be unpacked: ${x instanceof Error ? x.message : x}`, "error");
      return null;
    } finally {
      setBusy(null);
    }
  };
  /** Every file, unpacked into a new folder named after the archive inside the folder chosen.
   *  Paths that would leave that folder ("../", drive letters) are skipped, and names Windows
   *  cannot use are made safe; nothing already on disk is replaced. */
  const extractAll = async () => {
    if (total > MAX_TOTAL) {
      host.toast(`${host.name} unpacks to ${sizeText(total)}, more than can be extracted here.`, "error");
      return;
    }
    const dest = (await platform.pickOpen({ directory: true }))[0];
    if (!dest) return;
    setBusy(EXTRACT);
    let done = 0;
    let skipped = 0;
    try {
      const base = stem(host.name) || "Extracted";
      let root = "";
      for (let i = 1; i < 100 && !root; i++) {
        const candidate = join(dest, i === 1 ? base : `${base} (${i})`);
        if (await platform.createFolder(candidate)) root = candidate;
      }
      if (!root) throw new Error("No free folder name was found.");
      const made = new Set<string>();
      for (const e of entries) {
        const parts = e.path.split(/[\\/]+/).filter(Boolean);
        if (!parts.length || parts.some((p) => p === "." || p === ".." || /^[a-zA-Z]:$/.test(p)) || e.size > MAX_ENTRY) {
          skipped++;
          continue;
        }
        const safe = parts.map((p) => p.replace(/[<>:"|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, (m) => "_".repeat(m.length)));
        let dir = root;
        for (const p of safe.slice(0, -1)) {
          dir = join(dir, p);
          if (!made.has(dir)) {
            await platform.createFolder(dir);
            made.add(dir);
          }
        }
        setProgress(`Extracting ${done + skipped + 1} of ${entries.length}…`);
        const bytes = await readPartBytes(zip!, e.path, MAX_ENTRY).catch(() => null);
        if (!bytes) {
          skipped++;
          continue;
        }
        await platform.writeFile(join(dir, safe[safe.length - 1]), bytes);
        done++;
      }
      host.toast(`Extracted ${done.toLocaleString()} ${done === 1 ? "file" : "files"} to the \u201c${basename(root)}\u201d folder${skipped ? `; ${skipped} could not be unpacked` : ""}`);
      void platform.reveal(root).catch(() => {});
    } catch (x) {
      host.toast(`Extract stopped after ${done} ${done === 1 ? "file" : "files"}: ${x instanceof Error ? x.message : x}`, "error");
    } finally {
      setBusy(null);
      setProgress(null);
    }
  };
  const extractAllRef = useRef(extractAll);
  extractAllRef.current = extractAll;
  const open = async (e: Entry) => {
    const bytes = await read(e);
    if (bytes) openBytes(basename(e.path), bytes, { notice: { text: `Opened from ${host.name}. Save it to keep a copy of your own.`, tone: "info" } });
  };
  const save = async (e: Entry) => {
    const target = await platform.pickSave({ defaultPath: basename(e.path) });
    if (!target) return;
    const bytes = await read(e);
    if (!bytes) return;
    await platform.writeFile(target, bytes, { snapshot: true });
    host.toast(`Saved ${basename(target)}`);
  };

  if (err) return <ErrorState tabId={host.tabId} path={host.path} title={`${host.name} can't be opened`} message={err} />;
  if (!zip) return <div className="center-note"><div className="spinner" /></div>;
  if (!entries.length) return <div className="center-note"><FolderOpen size={28} /><h3>This archive is empty</h3></div>;
  // Only the rows in view are drawn: an archive can hold a hundred thousand files.
  const firstRow = Math.max(0, Math.floor(view.top / ROW_H) - 20);
  const lastRow = Math.min(entries.length, Math.ceil((view.top + view.height) / ROW_H) + 20);
  return (
    <div className="archive" ref={scrollRef} onScroll={(e) => setView({ top: e.currentTarget.scrollTop - LIST_TOP, height: e.currentTarget.clientHeight })}>
      <div className="archive-head" aria-hidden="true">
        <span>Name</span>
        <span>Size</span>
        <span className="date">Modified</span>
      </div>
      <ul className="archive-list" aria-label={`Files in ${host.name}`} style={{ height: entries.length * ROW_H }}>
        {entries.slice(firstRow, lastRow).map((e, k) => {
          const i = firstRow + k;
          const slash = e.path.lastIndexOf("/");
          const folder = slash >= 0 ? e.path.slice(0, slash + 1) : "";
          return (
            <li key={e.path} className="archive-row" style={{ top: i * ROW_H }} aria-setsize={entries.length} aria-posinset={i + 1}>
              <button className="archive-open" onClick={() => void open(e)} disabled={busy === e.path} title={`Open ${e.path}`}>
                <KindIcon kind={kindFromName(e.path)} name={e.path} />
                <span className="name">
                  {folder && <span className="folder">{folder}</span>}
                  {e.path.slice(slash + 1)}
                </span>
                <span className="size">{sizeText(e.size)}</span>
                <span className="date">{e.date.toLocaleDateString()}</span>
              </button>
              <button className="icon-btn" aria-label={`Save ${basename(e.path)} as…`} title="Save a copy…" onClick={() => void save(e)}>
                <Download />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
