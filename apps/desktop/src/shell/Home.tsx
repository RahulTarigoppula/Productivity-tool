import { useState } from "react";
import { useEffect } from "react";
import { NotebookText, FileCode2, Sheet, FolderOpen, FileSearch, Pin, PinOff, X, FileType, FileSpreadsheet, Presentation, Search, Clock, Sparkles } from "lucide-react";
import { platform } from "../platform";
import { useStore } from "../app/store";
import { newFile, newOfficeFile, pickAndOpen, openFolder, openPath, togglePin, removeRecent } from "../app/actions";
import { basename, dirname, samePath } from "../lib/paths";
import { rank } from "../lib/fuzzy";
import { KindIcon } from "./icons";
import { openPalette } from "../app/commands";

export function timeAgo(ms: number): string {
  const d = (Date.now() - ms) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)} min ago`;
  if (d < 86400) return `${Math.floor(d / 3600)} h ago`;
  if (d < 86400 * 7) return `${Math.floor(d / 86400)} d ago`;
  return new Date(ms).toLocaleDateString();
}

export function Home() {
  const recent = useStore((s) => s.recent);
  const pinned = useStore((s) => s.pinned);
  const [q, setQ] = useState("");
  const [office, setOffice] = useState(false);
  useEffect(() => {
    void platform.officePack().then((p) => setOffice(p.available)).catch(() => setOffice(false));
  }, []);
  const isPinned = (p: string) => pinned.some((x) => samePath(x, p));
  const items = q ? rank(recent, q, (r) => basename(r.path), undefined, 30).map((r) => r.item) : recent.filter((r) => !isPinned(r.path)).slice(0, 14);
  const pinnedItems = q ? [] : pinned.map((p) => recent.find((r) => samePath(r.path, p)) ?? { path: p, kind: "text" as const, opened: 0 });

  const row = (r: (typeof recent)[number]) => (
    <div key={r.path} className="recent-row" role="button" tabIndex={0} onClick={() => void openPath(r.path)} onKeyDown={(e) => e.key === "Enter" && void openPath(r.path)}>
      <KindIcon kind={r.kind} name={r.path} className="" />
      <div style={{ minWidth: 0 }}>
        <div className="n">{basename(r.path)}</div>
        <div className="p">{dirname(r.path)}</div>
      </div>
      <span className="when">{r.opened ? timeAgo(r.opened) : ""}</span>
      <span style={{ display: "flex" }}>
        <button className="icon-btn row-act" title={isPinned(r.path) ? "Unpin" : "Pin to top"} onClick={(e) => { e.stopPropagation(); void togglePin(r.path); }}>
          {isPinned(r.path) ? <PinOff /> : <Pin />}
        </button>
        <button className="icon-btn row-act" title="Remove from recent" onClick={(e) => { e.stopPropagation(); void removeRecent(r.path); }}>
          <X />
        </button>
      </span>
    </div>
  );

  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Working late" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const create: { kind: string; label: string; hint: string; icon: React.ReactNode; run: () => void }[] = [
    { kind: "markdown", label: "Note", hint: "Markdown", icon: <NotebookText />, run: () => newFile("markdown") },
    { kind: "text", label: "Text or code", hint: "Any language", icon: <FileCode2 />, run: () => newFile("text") },
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
    <div className="home">
      <div className="home-inner">
        <header className="home-head">
          <div className="app-mark" aria-hidden><Sparkles /></div>
          <div>
            <h1>{greeting}</h1>
            <p className="sub">Every kind of file, in one calm place.</p>
          </div>
        </header>
        <div className="home-search">
          <Search className="lead" />
          <input
            className="input"
            placeholder="Find a recent file"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && items[0]) void openPath(items[0].path);
              if (e.key === "Enter" && !items[0] && q) openPalette(q);
            }}
            aria-label="Find a recent file"
          />
          <button className="kbd keys-only search-kbd" onClick={() => openPalette("")} title="Search files and commands">Ctrl K</button>
        </div>

        <h2>Create</h2>
        <div className="create-grid">
          {create.map((c) => (
            <button key={c.kind} className={`create-card k-${c.kind}`} onClick={c.run}>
              <span className="chip">{c.icon}</span>
              <span className="t">{c.label}</span>
              <span className="d">{c.hint}</span>
            </button>
          ))}
        </div>

        <div className="open-row">
          <button className="open-btn" onClick={() => void pickAndOpen()}>
            <FileSearch />
            <span className="t">Open a file</span>
            <span className="kbd keys-only">Ctrl O</span>
          </button>
          {platform.folders && (
            <button className="open-btn" onClick={() => void openFolder()}>
              <FolderOpen />
              <span className="t">Open a folder</span>
              <span className="d">browse and search everything in it</span>
            </button>
          )}
        </div>

        {pinnedItems.length > 0 && (
          <>
            <h2>Pinned</h2>
            <div className="recent-list">{pinnedItems.map(row)}</div>
          </>
        )}
        <h2>{q ? "Matches" : "Recent"}</h2>
        {items.length ? (
          <div className="recent-list">{items.map(row)}</div>
        ) : (
          <div className="home-empty">
            <Clock />
            <div>
              <div className="t">{q ? "No recent file matches" : "Nothing here yet"}</div>
              <div className="d">
                {q ? "Press Enter to search everywhere." : <>Files you open or create show up here.<span className="keys-only"> You can also drop files anywhere in the window.</span></>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
