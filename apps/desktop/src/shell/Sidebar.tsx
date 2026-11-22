import { useEffect, useState, useCallback } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, RefreshCw, X, FolderSearch, ListTree, Files, CaseSensitive, Regex, WholeWord } from "lucide-react";
import { useStore, setState, handles, type LeftView } from "../app/store";
import { openPath, openFolder, closeFolder } from "../app/actions";
import { platform, type DirEntry, type SearchHit } from "../platform";
import { basename, samePath } from "../lib/paths";
import { kindFromName } from "../lib/formats";
import { KindIcon } from "./icons";
import { invalidateWorkspaceFiles } from "./Palette";

function TreeNode({ entry, depth, activePath, refreshKey }: { entry: DirEntry; depth: number; activePath: string | null; refreshKey: number }) {
  const [open, setOpen] = useState(false);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const load = useCallback(() => {
    void platform.listDir(entry.path).then(setChildren).catch(() => setChildren([]));
  }, [entry.path]);
  useEffect(() => {
    if (open) load();
  }, [open, load, refreshKey]);
  const pad = { paddingLeft: 6 + depth * 14 };
  if (entry.isDir) {
    return (
      <>
        <div className="tree-row" style={pad} role="treeitem" aria-expanded={open} tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === "Enter" && setOpen(!open)}>
          {open ? <ChevronDown /> : <ChevronRight />}
          {open ? <FolderOpen style={{ color: "var(--text-3)" }} /> : <Folder style={{ color: "var(--text-3)" }} />}
          <span className="name">{entry.name}</span>
        </div>
        {open && children?.map((c) => <TreeNode key={c.path} entry={c} depth={depth + 1} activePath={activePath} refreshKey={refreshKey} />)}
      </>
    );
  }
  const active = activePath ? samePath(activePath, entry.path) : false;
  return (
    <div className={`tree-row ${active ? "active" : ""}`} style={{ paddingLeft: 26 + depth * 14 }} role="treeitem" tabIndex={0} title={entry.path} onClick={() => void openPath(entry.path)} onKeyDown={(e) => e.key === "Enter" && void openPath(entry.path)}>
      <KindIcon kind={kindFromName(entry.name)} name={entry.name} className="" />
      <span className="name">{entry.name}</span>
    </div>
  );
}

function FilesView() {
  const workspace = useStore((s) => s.workspace);
  const activePath = useStore((s) => s.tabs.find((t) => t.id === s.activeId)?.path ?? null);
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (workspace) void platform.listDir(workspace).then(setEntries).catch(() => setEntries([]));
  }, [workspace, refreshKey]);
  // Refresh when the window regains focus (files may have changed elsewhere) and after saves.
  const savedCount = useStore((s) => s.tabs.filter((t) => t.saveState === "saved").length + s.recent.length);
  useEffect(() => {
    const onFocus = () => {
      invalidateWorkspaceFiles();
      setRefreshKey((k) => k + 1);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  useEffect(() => {
    setRefreshKey((k) => k + 1);
  }, [savedCount]);
  if (!workspace && !platform.folders) {
    return <div className="empty-note">Files you open appear in Recent on the home screen. Folders are not available on this device yet.</div>;
  }
  if (!workspace) {
    return (
      <div className="empty-note">
        Open a folder to browse every file in it — notes, tables, PDFs and code together.
        <div style={{ marginTop: 10 }}>
          <button className="btn primary" onClick={() => void openFolder()}>Open folder…</button>
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="side-title">
        <span className="grow" title={workspace}>{basename(workspace)}</span>
        <button className="icon-btn" title="Refresh" onClick={() => { invalidateWorkspaceFiles(); setRefreshKey((k) => k + 1); }}><RefreshCw /></button>
        <button className="icon-btn" title="Close folder" onClick={closeFolder}><X /></button>
      </div>
      <div role="tree">
        {entries.map((e) => <TreeNode key={e.path} entry={e} depth={0} activePath={activePath} refreshKey={refreshKey} />)}
      </div>
    </>
  );
}

function OutlineView() {
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeId));
  const outline = useStore((s) => (s.activeId ? s.outline[s.activeId] : undefined)) ?? [];
  if (!tab) return <div className="empty-note">Open a file to see its outline.</div>;
  if (!outline.length) return <div className="empty-note">No headings in this file yet.</div>;
  return (
    <div>
      {outline.map((o, i) => (
        <a key={i} className="outline-row" style={{ paddingLeft: 8 + (o.level - 1) * 14, fontWeight: o.level === 1 ? 600 : 400 }} href="#" onClick={(e) => { e.preventDefault(); handles.get(tab.id)?.goTo?.(o.loc); }}>
          {o.text}
        </a>
      ))}
    </div>
  );
}

function SearchView() {
  const workspace = useStore((s) => s.workspace);
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState({ caseSensitive: false, regex: false, wholeWord: false });
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!workspace || q.trim().length < 2) {
      setHits(null);
      return;
    }
    const t = setTimeout(() => {
      setBusy(true);
      platform
        .searchFolder(workspace, q, { ...opts, maxHits: 2000 })
        .then((h) => { setHits(h); setErr(null); })
        .catch((e) => setErr(String(e)))
        .finally(() => setBusy(false));
    }, 220);
    return () => clearTimeout(t);
  }, [q, opts, workspace]);
  if (!workspace) return <div className="empty-note">Open a folder to search inside all of its files.</div>;
  const byFile = new Map<string, SearchHit[]>();
  for (const h of hits ?? []) byFile.set(h.path, [...(byFile.get(h.path) ?? []), h]);
  const t = (k: keyof typeof opts) => setOpts((o) => ({ ...o, [k]: !o[k] }));
  return (
    <>
      <div className="search-box">
        <input className="input" autoFocus placeholder="Search in folder" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search in folder" />
        <div className="toggles">
          <button className={`icon-btn ${opts.caseSensitive ? "active" : ""}`} title="Match case" onClick={() => t("caseSensitive")}><CaseSensitive /></button>
          <button className={`icon-btn ${opts.wholeWord ? "active" : ""}`} title="Whole word" onClick={() => t("wholeWord")}><WholeWord /></button>
          <button className={`icon-btn ${opts.regex ? "active" : ""}`} title="Regular expression" onClick={() => t("regex")}><Regex /></button>
          <span style={{ flex: 1 }} />
          {busy && <span className="spinner" style={{ width: 16, height: 16 }} />}
        </div>
      </div>
      {err && <div className="empty-note" style={{ color: "var(--danger)" }}>{err}</div>}
      {hits && !hits.length && !err && <div className="empty-note">No results.</div>}
      {hits && hits.length > 0 && <div className="empty-note" style={{ padding: "0 8px 6px" }}>{hits.length}{hits.length >= 2000 ? "+" : ""} results in {byFile.size} files</div>}
      {[...byFile.entries()].map(([path, hs]) => (
        <div key={path}>
          <div className="hit-file"><KindIcon kind={kindFromName(path)} name={path} className="" />{basename(path)}</div>
          {hs.map((h) => (
            <a key={h.line} className="hit" href="#" title={h.text} onClick={(e) => { e.preventDefault(); void openPath(path, { goTo: String(h.line) }); }}>
              <b>{h.line}</b>{h.text.trim()}
            </a>
          ))}
        </div>
      ))}
    </>
  );
}

export function Sidebar() {
  const view = useStore((s) => s.leftView);
  const views: [LeftView, string, React.ReactNode][] = [
    ["files", "Files", <Files key="f" />],
    ["outline", "Outline", <ListTree key="o" />],
    ["search", "Search", <FolderSearch key="s" />],
  ];
  return (
    <aside className="side" aria-label="Sidebar">
      <div className="side-head">
        <div className="seg" role="tablist">
          {views.map(([v, label, icon]) => (
            <button key={v} role="tab" aria-selected={view === v} className={`icon-btn ${view === v ? "active" : ""}`} onClick={() => setState({ leftView: v })}>
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="side-body">
        {view === "files" && <FilesView />}
        {view === "outline" && <OutlineView />}
        {view === "search" && <SearchView />}
      </div>
    </aside>
  );
}
