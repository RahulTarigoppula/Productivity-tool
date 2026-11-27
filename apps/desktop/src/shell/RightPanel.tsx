import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useStore, setState, getState, handles, toast, type RightView } from "../app/store";
import { openBytes, replaceContent } from "../app/actions";
import { platform, type SnapshotInfo, type FileMeta } from "../platform";
import { basename, dirname, extname, stem } from "../lib/paths";
import { KIND_LABEL } from "../lib/formats";
import { timeAgo } from "./Home";

const fmtSize = (n: number) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function History() {
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeId));
  const saveState = tab?.saveState;
  const [list, setList] = useState<SnapshotInfo[] | null>(null);
  useEffect(() => {
    setList(null);
    if (tab?.path) void platform.snapshotList(tab.path).then(setList).catch(() => setList([]));
  }, [tab?.path, saveState]);
  if (!tab) return <div className="empty-note">Open a file to see its versions.</div>;
  if (!tab.path) return <div className="empty-note">This file has not been saved yet. Versions are kept automatically once it has a place on disk.</div>;
  if (!list) return <div className="empty-note">Loading…</div>;
  if (!list.length) return <div className="empty-note">No earlier versions yet. Each time you save, the previous content is kept here — at most every few minutes while auto-saving.</div>;
  const restore = async (s: SnapshotInfo) => {
    const bytes = await platform.snapshotRead(tab.path!, s.id);
    // What is there now is kept first, so restoring never loses it: the file as saved and, if
    // there are unsaved edits, those too.
    try {
      const onDisk = await platform.readFile(tab.path!).catch(() => null);
      if (onDisk?.length) await platform.snapshotWrite(tab.path!, onDisk, "before restoring an earlier version");
      const h = handles.get(tab.id);
      if (tab.dirty && h) await platform.snapshotWrite(tab.path!, await h.serialize(), "unsaved changes, before restoring");
    } catch (e) {
      toast(`Not restored: the current content could not be kept first (${e instanceof Error ? e.message : String(e)}).`, "error");
      return;
    }
    replaceContent(tab.id, bytes, `Restored the version from ${new Date(s.created).toLocaleString()}. Save to keep it; the current content stays in history.`);
  };
  const openCopy = async (s: SnapshotInfo) => {
    const bytes = await platform.snapshotRead(tab.path!, s.id);
    const ext = extname(tab.path!);
    openBytes(`${stem(tab.path!)} (${new Date(s.created).toLocaleString().replace(/[/:]/g, "-")})${ext ? "." + ext : ""}`, bytes, { kind: tab.kind });
  };
  return (
    <div>
      <div className="empty-note" style={{ padding: "4px 4px 10px" }}>Earlier versions of {basename(tab.path)}, kept privately by the app. Restoring never deletes anything.</div>
      {list.map((s) => (
        <div key={s.id} className="version">
          <div className="when">{new Date(s.created).toLocaleString()}</div>
          <div className="meta">{timeAgo(s.created)} · {fmtSize(s.size)} · {s.reason === "original" ? "original, before this app first saved it" : s.reason}</div>
          <div className="acts">
            <button className="btn" onClick={() => void restore(s)} disabled={tab.kind !== getState().tabs.find((t) => t.id === tab.id)?.kind}>Restore</button>
            <button className="btn subtle" onClick={() => void openCopy(s)}>Open as copy</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function Properties() {
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeId));
  const [meta, setMeta] = useState<FileMeta | null>(null);
  useEffect(() => {
    if (tab?.path) void platform.stat(tab.path).then(setMeta);
    else setMeta(null);
  }, [tab?.path, tab?.saveState]);
  if (!tab) return <div className="empty-note">No file open.</div>;
  const rows: [string, string][] = [
    ["Name", tab.name],
    ["Type", KIND_LABEL[tab.kind]],
    ["Folder", tab.path ? dirname(tab.path) : "Not saved yet"],
  ];
  if (meta?.exists) rows.push(["Size", fmtSize(meta.size)], ["Modified", new Date(meta.modified).toLocaleString()], ["Read-only", meta.readonly ? "Yes" : "No"]);
  return (
    <div style={{ padding: 6, userSelect: "text" }}>
      {rows.map(([k, v]) => (
        <div key={k} className="field" style={{ gridTemplateColumns: "90px 1fr" }}>
          <span className="help">{k}</span>
          <span style={{ wordBreak: "break-all" }}>{v}</span>
        </div>
      ))}
    </div>
  );
}

export function RightPanel() {
  const view = useStore((s) => s.rightView);
  const views: [RightView, string][] = [
    ["history", "Versions"],
    ["properties", "Properties"],
  ];
  return (
    <aside className="side right" aria-label="Details">
      <div className="side-head">
        <div className="seg" role="tablist" aria-label="Detail views">
          {views.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={view === v} className={`icon-btn ${view === v ? "active" : ""}`} onClick={() => setState({ rightView: v })}>
              {label}
            </button>
          ))}
        </div>
        <button className="icon-btn" title="Close panel" onClick={() => setState({ rightOpen: false })}><X /></button>
      </div>
      <div className="side-body">
        {view === "history" && <History />}
        {view === "properties" && <Properties />}
        {view === "preview" && <History />}
      </div>
    </aside>
  );
}
