import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Download } from "lucide-react";
import type JSZip from "jszip";
import type { EngineHost } from "../../app/editor-api";
import { openZip } from "../office/ooxml";
import { openBytes } from "../../app/actions";
import { platform } from "../../platform";
import { basename } from "../../lib/paths";
import { KindIcon } from "../../shell/icons";
import { kindFromName } from "../../lib/formats";

/** Files larger than this are not opened from an archive (the same limit as opening from disk). */
const MAX_ENTRY = 300 * 1024 * 1024;

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

  useEffect(() => {
    let live = true;
    openZip(host.bytes)
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
    host.setToolbar([]);
    host.setStatus(zip ? [{ id: "count", text: `${entries.length.toLocaleString()} ${entries.length === 1 ? "file" : "files"} · ${sizeText(total)} unpacked` }] : []);
  }, [host, zip, entries.length, total]);

  const read = async (e: Entry): Promise<Uint8Array | null> => {
    if (e.size > MAX_ENTRY) {
      host.toast(`${basename(e.path)} is too large to open from the archive.`, "error");
      return null;
    }
    setBusy(e.path);
    try {
      return await zip!.file(e.path)!.async("uint8array");
    } catch (x) {
      // Encrypted entries and damaged data end up here.
      host.toast(`${basename(e.path)} could not be unpacked: ${x instanceof Error ? x.message : x}`, "error");
      return null;
    } finally {
      setBusy(null);
    }
  };
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

  if (err) return <div className="center-note"><h3>{host.name} can't be opened</h3><div>{err}</div></div>;
  if (!zip) return <div className="center-note"><div className="spinner" /></div>;
  if (!entries.length) return <div className="center-note"><FolderOpen size={28} /><h3>This archive is empty</h3></div>;
  return (
    <div className="archive">
      <ul className="archive-list" aria-label={`Files in ${host.name}`}>
        {entries.map((e) => {
          const slash = e.path.lastIndexOf("/");
          const folder = slash >= 0 ? e.path.slice(0, slash + 1) : "";
          return (
            <li key={e.path} className="archive-row">
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
