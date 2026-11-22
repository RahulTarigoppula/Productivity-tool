import { Command as Cmdk } from "cmdk";
import { useEffect, useMemo, useState } from "react";
import { Terminal, Hash, CornerDownRight, FolderSearch, Keyboard, FileClock } from "lucide-react";
import { useStore, setState, getState, handles } from "../app/store";
import { allCommands } from "../app/commands";
import { activate, openPath } from "../app/actions";
import { rank, type Match } from "../lib/fuzzy";
import { basename, dirname, samePath } from "../lib/paths";
import { kindFromName } from "../lib/formats";
import { platform, type SearchHit } from "../platform";
import { KindIcon } from "./icons";

function Hl({ text, match }: { text: string; match?: Match }) {
  if (!match?.positions.length) return <>{text}</>;
  const set = new Set(match.positions);
  return (
    <>
      {[...text].map((ch, i) => (set.has(i) ? <mark key={i}>{ch}</mark> : <span key={i}>{ch}</span>))}
    </>
  );
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

  const mode = q.startsWith(">") ? ">" : q.startsWith("@") ? "@" : q.startsWith(":") ? ":" : q.startsWith("#") ? "#" : q.startsWith("?") ? "?" : "";
  const term = mode ? q.slice(1).trim() : q.trim();

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

  const s = getState();
  const active = s.tabs.find((t) => t.id === s.activeId);
  const commands = useMemo(() => (open ? allCommands() : []), [open, q]);

  if (!open) return null;

  const run = (f: () => void) => {
    close();
    setTimeout(f, 0);
  };

  let body: React.ReactNode;
  if (mode === ">") {
    const r = rank(commands, term, (c) => c.title, undefined, 80);
    body = (
      <Cmdk.Group heading="Commands">
        {r.map(({ item, match }) => (
          <Cmdk.Item key={item.id} value={item.id} onSelect={() => run(() => void item.run())}>
            <Terminal />
            <span className="label"><Hl text={item.title} match={match} /></span>
            {item.shortcut && <span className="kbd">{item.shortcut}</span>}
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
    ) : (
      [...byFile.entries()].slice(0, 40).map(([path, hs]) => (
        <Cmdk.Group key={path} heading={basename(path)}>
          {hs.slice(0, 8).map((h) => (
            <Cmdk.Item key={`${path}:${h.line}`} value={`${path}:${h.line}`} onSelect={() => run(() => void openPath(path, { goTo: String(h.line) }))}>
              <FolderSearch />
              <span className="label">{h.text.trim()}</span>
              <span className="hint">line {h.line}</span>
            </Cmdk.Item>
          ))}
        </Cmdk.Group>
      ))
    );
  } else if (mode === "?") {
    const r = rank(commands.filter((c) => c.shortcut), term, (c) => c.title, undefined, 200);
    body = (
      <Cmdk.Group heading="Keyboard shortcuts">
        {r.map(({ item }) => (
          <Cmdk.Item key={item.id} value={item.id} onSelect={() => run(() => void item.run())}>
            <Keyboard />
            <span className="label">{item.title}</span>
            <span className="kbd">{item.shortcut}</span>
          </Cmdk.Item>
        ))}
      </Cmdk.Group>
    );
  } else {
    const tabs = rank(s.tabs, term, (t) => t.name, (t) => (t.id === s.activeId ? -50 : 100), 20);
    const openPaths = s.tabs.map((t) => t.path).filter(Boolean) as string[];
    const recent = rank(
      s.recent.filter((r) => !openPaths.some((p) => samePath(p, r.path))),
      term,
      (r) => basename(r.path),
      (r) => Math.max(0, 60 - (Date.now() - r.opened) / 3.6e6),
      term ? 15 : 8,
    );
    const ws = term
      ? rank(files.filter((f) => !openPaths.some((p) => samePath(p, f)) && !s.recent.some((r) => samePath(r.path, f))), term, (f) => basename(f), undefined, 20)
      : [];
    const cmds = term ? rank(commands, term, (c) => c.title, undefined, 8) : [];
    body = (
      <>
        {tabs.length > 0 && (
          <Cmdk.Group heading="Open files">
            {tabs.map(({ item, match }) => (
              <Cmdk.Item key={item.id} value={`tab-${item.id}`} onSelect={() => run(() => activate(item.id))}>
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
              <Cmdk.Item key={item.path} value={`r-${item.path}`} onSelect={() => run(() => void openPath(item.path))}>
                <FileClock />
                <span className="label"><Hl text={basename(item.path)} match={match} /></span>
                <span className="hint">{dirname(item.path)}</span>
              </Cmdk.Item>
            ))}
          </Cmdk.Group>
        )}
        {ws.length > 0 && (
          <Cmdk.Group heading="In this folder">
            {ws.map(({ item, match }) => (
              <Cmdk.Item key={item} value={`f-${item}`} onSelect={() => run(() => void openPath(item))}>
                <KindIcon kind={kindFromName(item)} name={item} className="" />
                <span className="label"><Hl text={basename(item)} match={match} /></span>
                <span className="hint">{workspace ? dirname(item).slice(workspace.length) || "/" : dirname(item)}</span>
              </Cmdk.Item>
            ))}
          </Cmdk.Group>
        )}
        {cmds.length > 0 && (
          <Cmdk.Group heading="Commands">
            {cmds.map(({ item, match }) => (
              <Cmdk.Item key={item.id} value={item.id} onSelect={() => run(() => void item.run())}>
                <Terminal />
                <span className="label"><Hl text={item.title} match={match} /></span>
                {item.shortcut && <span className="kbd">{item.shortcut}</span>}
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
                  <Terminal />
                  <span className="label">{item.title}</span>
                  {item.shortcut && <span className="kbd">{item.shortcut}</span>}
                </Cmdk.Item>
              ))}
          </Cmdk.Group>
        )}
      </>
    );
  }

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <Cmdk className="palette" shouldFilter={false} loop label="Search files and commands" onKeyDown={(e) => e.key === "Escape" && close()}>
        <Cmdk.Input autoFocus value={q} onValueChange={setQ} placeholder="Search files and commands — type > for commands, # to search in files, : to go to, @ for headings" />
        <Cmdk.List>
          <Cmdk.Empty>No matches.</Cmdk.Empty>
          {body}
        </Cmdk.List>
        <div className="foot">
          <span><span className="kbd">&gt;</span> commands</span>
          <span><span className="kbd">#</span> search in folder</span>
          <span><span className="kbd">:</span> go to</span>
          <span><span className="kbd">@</span> headings</span>
          <span><span className="kbd">?</span> shortcuts</span>
        </div>
      </Cmdk>
    </div>
  );
}

export function invalidateWorkspaceFiles() {
  workspaceFiles = null;
}
