import { Command as Cmdk } from "cmdk";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { pushLayer, popLayer, focusMain } from "./modalFocus";
import { Zap, Hash, CornerDownRight, FolderSearch, Keyboard } from "lucide-react";
import { useStore, setState, getState, handles } from "../app/store";
import { allCommands } from "../app/commands";
import { activate, openPath, focusIfStranded, expectDocumentFocus } from "../app/actions";
import type { Command } from "../app/editor-api";
import { rank, type Match } from "../lib/fuzzy";
import { basename, dirname } from "../lib/paths";
import { kindFromName } from "../lib/formats";
import { platform, type SearchHit } from "../platform";
import { KindIcon } from "./icons";

/** Keys that are not commands, for the shortcuts list. */
const KEY_HELP: Command[] = [
  { id: "keys.regions", title: "Move between the tab bar, toolbar, document and status bar", shortcut: "F6, Shift+F6", run: () => {} },
  { id: "keys.tabs", title: "Move along the tabs in the tab bar (Enter opens one)", shortcut: "← →", run: () => {} },
  { id: "keys.closeTab", title: "Close the tab the tab bar is on", shortcut: "Delete", run: () => {} },
  { id: "keys.leaveEditor", title: "Leave a note or code editor (Tab indents inside it)", shortcut: "Esc, then Tab", run: () => {} },
];

/** A membership test for paths that matches as samePath does (drive-letter paths ignore case), built
 *  once so thousands of folder files can be checked on each key press. */
export function pathMatcher(paths: string[]): (p: string) => boolean {
  const n = (s: string) => s.replace(/\\/g, "/").replace(/\/+$/, "");
  const exact = new Set<string>();
  const folded = new Set<string>();
  for (const p of paths) {
    if (/^[a-zA-Z]:/.test(p)) folded.add(n(p).toLowerCase());
    else exact.add(n(p));
  }
  return (p) => exact.has(n(p)) || (folded.size > 0 && folded.has(n(p).toLowerCase()));
}

function Hl({ text, match }: { text: string; match?: Match }) {
  if (!match?.positions.length) return <>{text}</>;
  // Positions count UTF-16 units; characters are walked whole (an emoji is two units).
  const set = new Set(match.positions);
  const parts: React.ReactNode[] = [];
  let i = 0;
  for (const ch of text) {
    parts.push(set.has(i) ? <mark key={i}>{ch}</mark> : <span key={i}>{ch}</span>);
    i += ch.length;
  }
  return <>{parts}</>;
}

let workspaceFiles: { root: string; files: string[] } | null = null;

function close() {
  setState({ palette: { open: false, query: "" } });
}

export function Palette() {
  const { open, query: initial } = useStore((s) => s.palette);
  const [q, setQ] = useState(initial);
  const [files, setFiles] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const workspace = useStore((s) => s.workspace);

  useEffect(() => {
    if (open) setQ(initial);
  }, [open, initial]);

  useEffect(() => {
    if (!open || !workspace) return;
    if (workspaceFiles?.root === workspace) {
      setFiles(workspaceFiles.files);
      return;
    }
    void platform.findFiles(workspace, 20000).then((f) => {
      workspaceFiles = { root: workspace, files: f };
      setFiles(f);
    });
  }, [open, workspace]);

  // (Not deferred: Enter right after typing must choose from the list for what was typed.)
  const shownQ = q;
  const folderFiles = useMemo(() => files.map((path) => ({ path, name: basename(path) })), [files]);
  const mode = shownQ.startsWith(">") ? ">" : shownQ.startsWith("@") ? "@" : shownQ.startsWith(":") ? ":" : shownQ.startsWith("#") ? "#" : shownQ.startsWith("?") ? "?" : "";
  const term = mode ? shownQ.slice(1).trim() : shownQ.trim();

  useEffect(() => {
    if (mode !== "#" || !workspace || term.length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void platform.searchFolder(workspace, term, { caseSensitive: false, regex: false, wholeWord: false, maxHits: 200 }).then(setHits).catch(() => setHits([]));
    }, 180);
    return () => clearTimeout(t);
  }, [mode, term, workspace]);

  // React keeps its previous render, closures and all, so this render holds on to nothing that holds
  // a document: only the state's plain data (its toolbar and status entries are handlers over the
  // open documents), and the commands are not memoized.
  const { tabs: openTabs, activeId, outline, recent: recentFiles } = getState();
  const s = { tabs: openTabs, activeId, outline, recent: recentFiles };
  const active = s.tabs.find((t) => t.id === s.activeId);
  const commands = open ? allCommands() : [];

  // Focus returns to where the person was when the palette closes (Esc or after a choice that
  // does not move focus itself).
  const overlayRef = useRef<HTMLDivElement>(null);
  const focusBefore = useRef<HTMLElement | null>(null);
  const openingFile = useRef(false);
  useLayoutEffect(() => {
    if (open) {
      // Noted before the search box takes the keyboard (which is why it has no autoFocus).
      focusBefore.current = document.activeElement as HTMLElement | null;
      overlayRef.current?.querySelector<HTMLElement>("[cmdk-input]")?.focus();
      // While the palette is open it is the top layer: dialogs below ignore Tab and Escape, Tab
      // stays in the palette, Escape closes it wherever focus is, and the window behind is inert.
      const layer = pushLayer(overlayRef.current);
      const onKey = (e: KeyboardEvent) => {
        const box = overlayRef.current;
        if (!box) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          setState({ palette: { open: false, query: "" } });
        } else if (e.key === "Tab") {
          e.preventDefault();
          box.querySelector<HTMLElement>("[cmdk-input]")?.focus();
        }
      };
      window.addEventListener("keydown", onKey, true);
      // Screen readers follow the highlighted result through aria-activedescendant. The list
      // library sets it only when its own value changes, but results are replaced as one types, so
      // it is kept in step with whichever item is highlighted now.
      const box = overlayRef.current;
      const sync = () => {
        const input = box?.querySelector<HTMLElement>("[cmdk-input]");
        const item = box?.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]');
        if (!input) return;
        const want = item?.id ?? null;
        if (input.getAttribute("aria-activedescendant") !== want) {
          if (want) input.setAttribute("aria-activedescendant", want);
          else input.removeAttribute("aria-activedescendant");
        }
      };
      const mo = new MutationObserver(sync);
      if (box) mo.observe(box, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected"] });
      sync();
      return () => {
        mo.disconnect();
        window.removeEventListener("keydown", onKey, true);
        popLayer(layer);
      };
    }
    const prev = focusBefore.current;
    // Not opened yet (the first render).
    if (!prev) return;
    focusBefore.current = null;
    // A file was chosen: the keyboard goes to it once it is shown, not back where it was.
    if (openingFile.current) {
      openingFile.current = false;
      window.setTimeout(() => {
        const id = getState().activeId;
        if (id) focusIfStranded(id);
        if (!document.activeElement || document.activeElement === document.body) focusMain();
      }, 0);
      return;
    }
    window.setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      if (prev.isConnected && prev !== document.body) prev.focus();
      else focusMain();
    }, 0);
  }, [open]);

  if (!open) return null;

  const run = (f: () => void) => {
    close();
    setTimeout(f, 0);
  };
  const runOpen = (f: () => void) => {
    openingFile.current = true;
    expectDocumentFocus();
    // The keyboard is parked on the tab strip meanwhile, never left in the old document.
    (document.activeElement as HTMLElement | null)?.blur();
    run(f);
  };

  let body: React.ReactNode;
  if (mode === ">") {
    const r = rank(commands, term, (c) => c.title, undefined, 80);
    body = (
      <Cmdk.Group heading="Commands">
        {r.map(({ item, match }) => (
          <Cmdk.Item key={item.id} value={item.id} onSelect={() => run(() => void item.run())}>
            <Zap />
            <span className="label"><Hl text={item.title} match={match} /></span>
            {item.shortcut && <span className="kbd keys-only">{item.shortcut}</span>}
          </Cmdk.Item>
        ))}
      </Cmdk.Group>
    );
  } else if (mode === "@") {
    const outline = active ? s.outline[active.id] ?? [] : [];
    const r = rank(outline, term, (o) => o.text, undefined, 200);
    body = (
      <Cmdk.Group heading={outline.length ? "Headings in this file" : "No headings in this file"}>
        {r.map(({ item, match }, i) => (
          <Cmdk.Item key={i} value={`o${i}`} onSelect={() => run(() => active && handles.get(active.id)?.goTo?.(item.loc))}>
            <Hash />
            <span className="label" style={{ paddingLeft: (item.level - 1) * 12 }}><Hl text={item.text} match={match} /></span>
          </Cmdk.Item>
        ))}
      </Cmdk.Group>
    );
  } else if (mode === ":") {
    const unit = active?.kind === "pdf" ? "page" : active?.kind === "csv" ? "row" : "line";
    body = (
      <Cmdk.Group heading="Go to">
        <Cmdk.Item value="goto" disabled={!active || !/^\d+$/.test(term)} onSelect={() => run(() => active && handles.get(active.id)?.goTo?.(term))}>
          <CornerDownRight />
          <span className="label">{/^\d+$/.test(term) ? `Go to ${unit} ${term}` : `Type a ${unit} number`}</span>
        </Cmdk.Item>
      </Cmdk.Group>
    );
  } else if (mode === "#") {
    const byFile = new Map<string, SearchHit[]>();
    for (const h of hits) byFile.set(h.path, [...(byFile.get(h.path) ?? []), h]);
    body = !workspace ? (
      <Cmdk.Empty>Open a folder to search inside its files.</Cmdk.Empty>
    ) : term.length < 2 ? (
      <Cmdk.Empty>Type at least two letters to search inside the files of {basename(workspace)}.</Cmdk.Empty>
    ) : byFile.size === 0 ? (
      <Cmdk.Empty>Nothing found in {basename(workspace)} yet. Keep typing, or check the spelling.</Cmdk.Empty>
    ) : (
      [...byFile.entries()].slice(0, 40).map(([path, hs]) => (
        <Cmdk.Group key={path} heading={basename(path)}>
          {hs.slice(0, 8).map((h) => (
            <Cmdk.Item key={`${path}:${h.line}`} value={`${path}:${h.line}`} onSelect={() => runOpen(() => void openPath(path, { goTo: String(h.line) }))}>
              <FolderSearch />
              <span className="label">{h.text.trim()}</span>
              <span className="hint">line {h.line}</span>
            </Cmdk.Item>
          ))}
        </Cmdk.Group>
      ))
    );
  } else if (mode === "?") {
    const seen = new Set<string>();
    const unique = commands.filter((c) => c.shortcut && !seen.has(c.shortcut) && (seen.add(c.shortcut), true));
    const r = rank([...unique, ...KEY_HELP], term, (c) => c.title, undefined, 200);
    body = (
      <Cmdk.Group heading="Keyboard shortcuts">
        {r.map(({ item }) => (
          <Cmdk.Item key={item.id} value={item.id} onSelect={() => run(() => void item.run())}>
            <Keyboard />
            <span className="label">{item.title}</span>
            <span className="kbd keys-only">{item.shortcut}</span>
          </Cmdk.Item>
        ))}
      </Cmdk.Group>
    );
  } else {
    const tabs = rank(s.tabs, term, (t) => t.name, (t) => (t.id === s.activeId ? -50 : 100), 20);
    const openPaths = s.tabs.map((t) => t.path).filter(Boolean) as string[];
    const isOpen = pathMatcher(openPaths);
    const recent = rank(
      s.recent.filter((r) => !isOpen(r.path)),
      term,
      (r) => basename(r.path),
      (r) => Math.max(0, 60 - (Date.now() - r.opened) / 3.6e6),
      term ? 15 : 8,
    );
    // Open and recent files are listed above, so the folder's own list leaves them out.
    const listedPaths = [...openPaths, ...s.recent.map((r) => r.path)];
    const listed = pathMatcher(listedPaths);
    // Ranked first and filtered after: only the best few are checked, not every file in the folder.
    const ws = term
      ? rank(folderFiles, term, (f) => f.name, undefined, 20 + listedPaths.length)
          .filter((r) => !listed(r.item.path))
          .slice(0, 20)
          .map(({ item, match }) => ({ item: item.path, match }))
      : [];
    const cmds = term ? rank(commands, term, (c) => c.title, undefined, 8) : [];
    body = (
      <>
        {tabs.length > 0 && (
          <Cmdk.Group heading="Open files">
            {tabs.map(({ item, match }) => (
              <Cmdk.Item key={item.id} value={`tab-${item.id}`} onSelect={() => runOpen(() => activate(item.id))}>
                <KindIcon kind={item.kind} name={item.name} className="" />
                <span className="label"><Hl text={item.name} match={match} />{item.dirty ? " ●" : ""}</span>
                <span className="hint">{item.path ? dirname(item.path) : "Unsaved"}</span>
              </Cmdk.Item>
            ))}
          </Cmdk.Group>
        )}
        {recent.length > 0 && (
          <Cmdk.Group heading="Recent">
            {recent.map(({ item, match }) => (
              <Cmdk.Item key={item.path} value={`r-${item.path}`} onSelect={() => runOpen(() => void openPath(item.path))}>
                <KindIcon kind={item.kind} name={item.path} className="" />
                <span className="label"><Hl text={basename(item.path)} match={match} /></span>
                <span className="hint">{dirname(item.path)}</span>
              </Cmdk.Item>
            ))}
          </Cmdk.Group>
        )}
        {ws.length > 0 && (
          <Cmdk.Group heading="In this folder">
            {ws.map(({ item, match }) => (
              <Cmdk.Item key={item} value={`f-${item}`} onSelect={() => runOpen(() => void openPath(item))}>
                <KindIcon kind={kindFromName(item)} name={item} className="" />
                <span className="label"><Hl text={basename(item)} match={match} /></span>
                <span className="hint">{workspace ? dirname(item).slice(workspace.length).replace(/^[\\/]/, "") || basename(workspace) : dirname(item)}</span>
              </Cmdk.Item>
            ))}
          </Cmdk.Group>
        )}
        {cmds.length > 0 && (
          <Cmdk.Group heading="Commands">
            {cmds.map(({ item, match }) => (
              <Cmdk.Item key={item.id} value={item.id} onSelect={() => run(() => void item.run())}>
                <Zap />
                <span className="label"><Hl text={item.title} match={match} /></span>
                {item.shortcut && <span className="kbd keys-only">{item.shortcut}</span>}
              </Cmdk.Item>
            ))}
          </Cmdk.Group>
        )}
        {!term && (
          <Cmdk.Group heading="Suggestions">
            {commands
              .filter((c) => ["file.newMarkdown", "file.open", "file.openFolder", "file.export", "view.focus"].includes(c.id))
              .map((item) => (
                <Cmdk.Item key={item.id} value={item.id} onSelect={() => run(() => void item.run())}>
                  <Zap />
                  <span className="label">{item.title}</span>
                  {item.shortcut && <span className="kbd keys-only">{item.shortcut}</span>}
                </Cmdk.Item>
              ))}
          </Cmdk.Group>
        )}
      </>
    );
  }

  return (
    <div className="overlay" ref={overlayRef} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <Cmdk className="palette" role="dialog" aria-modal="true" aria-label="Search files and commands" shouldFilter={false} loop label="Search files and commands" onKeyDown={(e) => e.key === "Escape" && close()}>
        <Cmdk.Input value={q} onValueChange={setQ} placeholder="Search files and commands" />
        <Cmdk.List>
          {/* Folder search has its own messages. */}
          {mode !== "#" && <Cmdk.Empty>No matches.</Cmdk.Empty>}
          {body}
        </Cmdk.List>
        <div className="foot">
          {mode ? (
            <span>
              {{ ">": "Commands", "#": "Searching inside the folder's files", ":": "Go to a line, page or row", "@": "Headings in this file", "?": "Keyboard shortcuts" }[mode]}
            </span>
          ) : (
            <span>
              Tip: start with <span className="kbd">&gt;</span> for commands, <span className="kbd">#</span> to search inside files<span className="keys-only">, <span className="kbd">?</span> for shortcuts</span>
            </span>
          )}
        </div>
      </Cmdk>
    </div>
  );
}

export function invalidateWorkspaceFiles() {
  workspaceFiles = null;
}
// A file renamed or saved under a new name: the folder's list is read again next time.
window.addEventListener("app:files-changed", invalidateWorkspaceFiles);
