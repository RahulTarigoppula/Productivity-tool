import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, ChevronDown, Folder, FolderOpen, RefreshCw, X, FolderSearch, ListTree, Files, CaseSensitive, Regex, WholeWord } from "lucide-react";
import { useStore, setState, handles, type LeftView } from "../app/store";
import { openPath, openFolder, closeFolder } from "../app/actions";
import { platform, type DirEntry, type SearchHit } from "../platform";
import { basename, samePath } from "../lib/paths";
import { kindFromName } from "../lib/formats";
import { KindIcon } from "./icons";
import { invalidateWorkspaceFiles } from "./Palette";

const ROW_H = 26;

interface Row {
  entry: DirEntry;
  depth: number;
  parent: string | null;
}

/** The folder's files as one list that only draws the rows in view, so a folder with tens of
 *  thousands of files opens at once. It follows the usual tree keys: one Tab stop; Up and Down
 *  move, Right opens a folder (or goes into it), Left closes it (or goes to its parent), Home and
 *  End jump, Enter or Space opens a file or folder. */
function FileTree({ workspace, refreshKey }: { workspace: string; refreshKey: number }) {
  const activePath = useStore((s) => s.tabs.find((t) => t.id === s.activeId)?.path ?? null);
  const [root, setRoot] = useState<DirEntry[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [kids, setKids] = useState<Map<string, DirEntry[]>>(() => new Map());
  const [cur, setCur] = useState(0);
  const [win, setWin] = useState({ top: 0, height: 600 });
  const treeRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef(false);

  // The folder and every open subfolder are listed again on refresh (after saves, on focus).
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  useEffect(() => {
    let live = true;
    void platform.listDir(workspace).then((e) => live && setRoot(e)).catch(() => live && setRoot([]));
    for (const dir of expandedRef.current)
      void platform
        .listDir(dir)
        .then((e) => live && setKids((m) => new Map(m).set(dir, e)))
        .catch(() => {});
    return () => {
      live = false;
    };
  }, [workspace, refreshKey]);
  useEffect(() => {
    setExpanded(new Set());
    setKids(new Map());
    setCur(0);
  }, [workspace]);

  const rows = useMemo(() => {
    const out: Row[] = [];
    const walk = (list: DirEntry[], depth: number, parent: string | null) => {
      for (const entry of list) {
        out.push({ entry, depth, parent });
        if (entry.isDir && expanded.has(entry.path)) walk(kids.get(entry.path) ?? [], depth + 1, entry.path);
      }
    };
    walk(root, 0, null);
    return out;
  }, [root, expanded, kids]);
  const at = Math.min(cur, Math.max(0, rows.length - 1));

  const toggle = (dir: string, open?: boolean) => {
    const willOpen = open ?? !expanded.has(dir);
    setExpanded((s) => {
      const n = new Set(s);
      if (willOpen) n.add(dir);
      else n.delete(dir);
      return n;
    });
    if (willOpen && !kids.has(dir))
      void platform
        .listDir(dir)
        .then((e) => setKids((m) => new Map(m).set(dir, e)))
        .catch(() => setKids((m) => new Map(m).set(dir, [])));
  };
  const activateRow = (r: Row) => (r.entry.isDir ? toggle(r.entry.path) : void openPath(r.entry.path));

  // The list scrolls with the sidebar; only the rows in view (and a few around them) are drawn.
  useEffect(() => {
    const tree = treeRef.current;
    const scroller = tree?.closest<HTMLElement>(".side-body");
    if (!tree || !scroller) return;
    const update = () => setWin({ top: scroller.getBoundingClientRect().top - tree.getBoundingClientRect().top, height: scroller.clientHeight });
    update();
    scroller.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(scroller);
    return () => {
      scroller.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);
  const first = Math.max(0, Math.floor(win.top / ROW_H) - 15);
  const last = Math.min(rows.length, Math.ceil((win.top + win.height) / ROW_H) + 15);

  const moveTo = (i: number) => {
    const n = Math.max(0, Math.min(rows.length - 1, i));
    setCur(n);
    focusAfter.current = true;
    const tree = treeRef.current;
    const scroller = tree?.closest<HTMLElement>(".side-body");
    if (tree && scroller) {
      const y = tree.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop + n * ROW_H;
      if (y < scroller.scrollTop) scroller.scrollTop = y;
      else if (y + ROW_H > scroller.scrollTop + scroller.clientHeight) scroller.scrollTop = y + ROW_H - scroller.clientHeight;
      setWin({ top: scroller.getBoundingClientRect().top - tree.getBoundingClientRect().top, height: scroller.clientHeight });
    }
  };
  useEffect(() => {
    if (!focusAfter.current) return;
    // The row may only be drawn once the list has scrolled to it: wait for it.
    const el = treeRef.current?.querySelector<HTMLElement>(`[data-row="${at}"]`);
    if (!el) return;
    focusAfter.current = false;
    el.focus();
  });
  const onKey = (e: React.KeyboardEvent) => {
    const r = rows[at];
    if (!r || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "ArrowDown") moveTo(at + 1);
    else if (e.key === "ArrowUp") moveTo(at - 1);
    else if (e.key === "Home") moveTo(0);
    else if (e.key === "End") moveTo(rows.length - 1);
    else if (e.key === "PageDown") moveTo(at + Math.max(1, Math.floor(win.height / ROW_H) - 1));
    else if (e.key === "PageUp") moveTo(at - Math.max(1, Math.floor(win.height / ROW_H) - 1));
    else if (e.key === "ArrowRight" && r.entry.isDir) {
      if (!expanded.has(r.entry.path)) toggle(r.entry.path, true);
      else if (rows[at + 1]?.parent === r.entry.path) moveTo(at + 1);
    } else if (e.key === "ArrowLeft") {
      if (r.entry.isDir && expanded.has(r.entry.path)) toggle(r.entry.path, false);
      else if (r.parent) moveTo(rows.findIndex((x) => x.entry.path === r.parent));
    } else if (e.key === "Enter" || e.key === " ") activateRow(r);
    else return;
    e.preventDefault();
  };

  return (
    <div role="tree" aria-label={`Files in ${basename(workspace)}`} ref={treeRef} onKeyDown={onKey} style={{ position: "relative", height: rows.length * ROW_H }}>
      {rows.slice(first, last).map((r, k) => {
        const i = first + k;
        const { entry, depth } = r;
        const open = entry.isDir && expanded.has(entry.path);
        const active = !entry.isDir && !!activePath && samePath(activePath, entry.path);
        return (
          <div
            key={entry.path}
            data-row={i}
            className={`tree-row ${active ? "active" : ""}`}
            style={{ position: "absolute", top: i * ROW_H, left: 0, right: 0, paddingLeft: (entry.isDir ? 6 : 26) + depth * 14 }}
            role="treeitem"
            aria-level={depth + 1}
            aria-expanded={entry.isDir ? open : undefined}
            aria-selected={entry.isDir ? undefined : active}
            tabIndex={i === at ? 0 : -1}
            title={entry.isDir ? undefined : entry.path}
            onFocus={() => i !== at && setCur(i)}
            onClick={() => {
              setCur(i);
              activateRow(r);
            }}
          >
            {entry.isDir ? (
              <>
                {open ? <ChevronDown /> : <ChevronRight />}
                {open ? <FolderOpen style={{ color: "var(--text-3)" }} /> : <Folder style={{ color: "var(--text-3)" }} />}
              </>
            ) : (
              <KindIcon kind={kindFromName(entry.name)} name={entry.name} className="" />
            )}
            <span className="name">{entry.name}</span>
          </div>
        );
      })}
    </div>
  );
}

function FilesView() {
  const workspace = useStore((s) => s.workspace);
  const [refreshKey, setRefreshKey] = useState(0);
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
        <button className="icon-btn" title="Refresh" aria-label="Refresh" onClick={() => { invalidateWorkspaceFiles(); setRefreshKey((k) => k + 1); }}><RefreshCw /></button>
        <button className="icon-btn" title="Close folder" aria-label="Close folder" onClick={closeFolder}><X /></button>
      </div>
      <FileTree workspace={workspace} refreshKey={refreshKey} />
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
      {hits && hits.length > 0 && <div className="empty-note" style={{ padding: "0 8px 6px" }}>{hits.length}{hits.length >= 2000 ? "+" : ""} {hits.length === 1 ? "result" : "results"} in {byFile.size} {byFile.size === 1 ? "file" : "files"}</div>}
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
        <div className="seg" role="tablist" aria-label="Sidebar views">
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
