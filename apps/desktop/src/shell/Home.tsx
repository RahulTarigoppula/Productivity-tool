import { useState } from "react";
import { useEffect } from "react";
import { NotebookText, FileText, Sheet, FolderOpen, FileSearch, Pin, PinOff, X, FileType, FileSpreadsheet, Presentation } from "lucide-react";
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

  return (
    <div className="home">
      <div className="home-inner">
        <h1>Productivity</h1>
        <p className="sub">Every kind of file, in one calm place. Press <span className="kbd">Ctrl+K</span> to find anything.</p>
        <div className="search">
          <input
            className="input"
            placeholder="Find a recent file…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && items[0]) void openPath(items[0].path);
              if (e.key === "Enter" && !items[0] && q) openPalette(q);
            }}
            aria-label="Find a recent file"
          />
        </div>
        <h2>New</h2>
        <div className="tiles">
          <button className="tile" onClick={() => newFile("markdown")}>
            <NotebookText style={{ color: "var(--k-markdown)" }} />
            <span className="t">Markdown note</span>
            <span className="d">Headings, lists, links</span>
          </button>
          <button className="tile" onClick={() => newFile("text")}>
            <FileText style={{ color: "var(--k-text)" }} />
            <span className="t">Text or code</span>
            <span className="d">Any language</span>
          </button>
          <button className="tile" onClick={() => newFile("csv")}>
            <Sheet style={{ color: "var(--k-csv)" }} />
            <span className="t">CSV table</span>
            <span className="d">Rows and columns</span>
          </button>
          {office && (
            <>
              <button className="tile" onClick={() => void newOfficeFile("docx")}>
                <FileType style={{ color: "var(--k-docx)" }} />
                <span className="t">Word document</span>
                <span className="d">Pages and styles</span>
              </button>
              <button className="tile" onClick={() => void newOfficeFile("xlsx")}>
                <FileSpreadsheet style={{ color: "var(--k-xlsx)" }} />
                <span className="t">Spreadsheet</span>
                <span className="d">Formulas and charts</span>
              </button>
              <button className="tile" onClick={() => void newOfficeFile("pptx")}>
                <Presentation style={{ color: "var(--k-pptx)" }} />
                <span className="t">Presentation</span>
                <span className="d">Slides</span>
              </button>
            </>
          )}
          <button className="tile" onClick={() => void pickAndOpen()}>
            <FileSearch style={{ color: "var(--accent)" }} />
            <span className="t">Open file</span>
            <span className="d">Ctrl+O</span>
          </button>
          {platform.folders && (
            <button className="tile" onClick={() => void openFolder()}>
              <FolderOpen style={{ color: "var(--accent)" }} />
              <span className="t">Open folder</span>
              <span className="d">Browse and search</span>
            </button>
          )}
        </div>
        {pinnedItems.length > 0 && (
          <>
            <h2>Pinned</h2>
            {pinnedItems.map(row)}
          </>
        )}
        <h2>{q ? "Matches" : "Recent"}</h2>
        {items.length ? items.map(row) : <div className="empty-note">{q ? "No recent file matches. Press Enter to search everywhere." : "Files you open will appear here."}</div>}
        <div className="drop-hint">Drop files anywhere in this window to open them.</div>
      </div>
    </div>
  );
}
