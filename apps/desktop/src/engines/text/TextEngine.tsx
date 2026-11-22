import { useEffect, useRef, useState } from "react";
import { EditorState, Compartment, Prec, type Text } from "@codemirror/state";
import {
  EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, dropCursor,
  rectangularSelection, crosshairCursor, highlightActiveLine,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput, syntaxHighlighting, bracketMatching, foldGutter, foldKeymap, indentUnit, syntaxTree, LanguageDescription } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches, openSearchPanel, search } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Bold, Italic, Heading1, Heading2, List, ListOrdered, ListTodo, Link2, Code, Quote, Table, Columns2, WrapText, Minus } from "lucide-react";
import type { EngineHost, ToolbarItem, OutlineItem, Command } from "../../app/editor-api";
import { decodeText, encodeText, describeFormat, canEncode, type TextFormat } from "../../lib/textcodec";
import { useStore, getState } from "../../app/store";
import { baseTheme, proseTheme, highlight } from "./theme";
import { livePreview, livePreviewTheme } from "./livePreview";
import { toggleWrap, setHeading, toggleLinePrefix, insertLink, insertBlock } from "./markdownCommands";
import { detectLanguage, loadLanguage, ALL_LANGUAGES, detectIndent } from "./language";
import { MarkdownPreview } from "./MarkdownPreview";
import { platform } from "../../platform";
import { dirname, relative, resolveDocumentRef } from "../../lib/paths";
import { openMenu } from "../../shell/Menu";
import { openPalette } from "../../app/commands";

const LARGE = 5_000_000;
const defaultEol = (): TextFormat["eol"] => (navigator.userAgent.includes("Windows") ? "\r\n" : "\n");

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;

function countWords(text: string): number {
  const m = text.match(WORD);
  return m ? m.length : 0;
}

/** Words in a whole document, read line by line (no giant string for large files). Lines are
 *  joined with a space, so a word never spans two lines. */
function countDocWords(doc: EditorState["doc"]): number {
  let n = 0;
  for (const it = doc.iterLines(); !it.next().done; ) {
    const m = it.value.match(WORD);
    if (m) n += m.length;
  }
  return n;
}

/** Documents above this size get their word count after a pause in typing, not on every key. */
const WORDS_SYNC_LIMIT = 200_000;

export default function TextEngine({ host }: { host: EngineHost }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const settings = useStore((s) => s.settings);
  const [preview, setPreview] = useState(false);
  const [previewText, setPreviewText] = useState("");
  const isMd = host.kind === "markdown";
  const comps = useRef({ lang: new Compartment(), wrap: new Compartment(), gutter: new Compartment(), live: new Compartment(), font: new Compartment(), indent: new Compartment() });
  const formatRef = useRef<TextFormat>({ encoding: "utf-8", bom: false, eol: defaultEol(), mixedEol: false });
  const baseline = useRef<Text | null>(null);
  /** True when the encoding or line endings were changed (content may be unchanged). */
  const formatDirty = useRef(false);
  const lastSerialized = useRef<Text | null>(null);
  const langName = useRef<string>(isMd ? "Markdown" : "Plain text");
  const imageCache = useRef(new Map<string, string>());
  const wrapOn = useRef(isMd || settings.wordWrapCode);
  const previewOpen = useRef(false);

  // Resolve images in Markdown relative to the file's folder.
  const resolveImage = async (src: string): Promise<string | null> => {
    // Remote images are never loaded (privacy: a document must not report that it was opened).
    if (/^data:image\//i.test(src)) return src;
    const cached = imageCache.current.get(src);
    if (cached) return cached;
    const base = host.path ? dirname(host.path) : getState().workspace;
    if (!base) return null;
    let target: string | null;
    try {
      target = resolveDocumentRef(base, decodeURIComponent(src));
    } catch {
      return null;
    }
    if (!target) return null;
    try {
      const bytes = await platform.readFile(target);
      const ext = src.split(".").pop()?.toLowerCase();
      const type = ext === "svg" ? "image/svg+xml" : ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg";
      const url = URL.createObjectURL(new Blob([bytes.slice()], { type }));
      imageCache.current.set(src, url);
      return url;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const decoded = host.bytes.length ? decodeText(host.bytes) : { text: "", format: formatRef.current, lossless: true };
    formatRef.current = decoded.format;
    if (decoded.format.encoding === "windows-1252" && host.bytes.length) host.toast(`${host.name} uses an older text format (Windows 1252). If some letters look wrong, the file may be damaged.`);
    if (decoded.format.mixedEol) {
      formatDirty.current = false;
      host.toast(`${host.name} mixes line-ending styles. Saving will use one style consistently.`);
    }
    const text = decoded.text;
    // Extremely deep nesting (hostile or broken files) is shown as plain text: the Markdown
    // parser would exhaust the stack on it.
    const tooDeep = isMd && (/^(?:[ \t]*>){200}/m.test(text) || /^[ \t]{400,}(?:[-*+]|\d+[.)]) /m.test(text));
    if (tooDeep) host.toast(`${host.name} is nested too deeply to format, so it is shown as plain text.`);
    const large = text.length > LARGE || tooDeep;
    const indent = detectIndent(text, getState().settings.tabSize);
    const c = comps.current;
    const s = getState().settings;
    const mdExt = isMd && !tooDeep ? [markdown({ base: markdownLanguage, codeLanguages: ALL_LANGUAGES })] : [];

    const updateOutline = (state: EditorState) => {
      if (!isMd) return;
      const items: OutlineItem[] = [];
      syntaxTree(state).iterate({
        enter: (n) => {
          const m = /^ATXHeading(\d)$/.exec(n.name) ?? /^SetextHeading(\d)$/.exec(n.name);
          if (m) {
            const line = state.doc.lineAt(n.from);
            items.push({ level: Number(m[1]), text: line.text.replace(/^#{1,6}\s+/, "").replace(/\s+#+\s*$/, ""), loc: String(line.number) });
            return false;
          }
        },
      });
      host.setOutline(items);
    };

    // Word count: cached per document version; large documents are counted after typing pauses.
    let words: { doc: EditorState["doc"]; n: number } | null = null;
    let wordsTimer = 0;
    const wordCount = (state: EditorState): number | null => {
      if (words?.doc === state.doc) return words.n;
      if (state.doc.length <= WORDS_SYNC_LIMIT) {
        words = { doc: state.doc, n: countDocWords(state.doc) };
        return words.n;
      }
      clearTimeout(wordsTimer);
      wordsTimer = window.setTimeout(() => {
        const v = viewRef.current;
        if (!v || v.state.doc !== state.doc) return;
        words = { doc: state.doc, n: countDocWords(state.doc) };
        updateStatus(v.state);
      }, 600);
      return words ? words.n : null;
    };

    const updateStatus = (state: EditorState) => {
      const sel = state.selection.main;
      const line = state.doc.lineAt(sel.head);
      const f = describeFormat(formatRef.current);
      // Notes show words; code shows the line. File-format details sit behind one "Details" item
      // and appear in the bar only when they are unusual.
      const items: { id: string; text: string; onClick?: () => void; align?: string; title?: string }[] = isMd
        ? []
        : [{ id: "pos", text: `Line ${line.number}, column ${sel.head - line.from + 1}`, onClick: () => openPalette(":") }];
      if (!sel.empty && sel.to - sel.from <= 2_000_000) {
        const t = state.sliceDoc(sel.from, sel.to);
        items.push({ id: "sel", text: `${t.length} selected${isMd || host.kind === "text" ? `, ${countWords(t)} words` : ""}`, onClick: undefined as never });
      }
      if (isMd || /\.(txt|text)$/i.test(host.name) || langName.current === "Plain text") {
        const n = wordCount(state);
        if (n !== null) items.push({ id: "words", text: `${n.toLocaleString()} words`, onClick: undefined as never });
      }
      const fmt = formatRef.current;
      const unusual = fmt.encoding !== "utf-8" || fmt.bom || fmt.mixedEol;
      const showDetails = () =>
        openMenu(window.innerWidth - 270, window.innerHeight - 40, [
          { label: `Language: ${langName.current}`, run: chooseLanguage },
          { label: `Text format: ${f.encoding}`, run: chooseEncoding },
          { label: `Line endings: ${f.eol === "CRLF" ? "Windows (CRLF)" : f.eol === "LF" ? "Unix (LF)" : f.eol}`, run: toggleEol },
          { label: `Indentation: ${indentLabel}`, disabled: true },
        ]);
      host.setStatus([
        ...items,
        ...(!isMd ? [{ id: "lang", text: langName.current, align: "right", title: "Set language", onClick: chooseLanguage }] : []),
        ...(unusual ? [{ id: "enc", text: f.encoding, align: "right", title: "Text format", onClick: chooseEncoding }] : []),
        { id: "details", text: "Details", align: "right", title: "Language, text format, line endings and indentation", onClick: showDetails },
      ] as never);
    };
    const indentLabel = indent.unit === "\t" ? "Tabs" : `${indent.size} spaces`;

    let outlineTimer = 0;
    const view = new EditorView({
      parent: ref.current!,
      state: EditorState.create({
        doc: text,
        extensions: [
          c.gutter.of(!isMd && s.lineNumbers ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : []),
          highlightSpecialChars(),
          history(),
          drawSelection(),
          dropCursor(),
          EditorState.allowMultipleSelections.of(true),
          indentOnInput(),
          syntaxHighlighting(highlight),
          bracketMatching(),
          closeBrackets(),
          autocompletion({ activateOnTyping: !isMd }),
          rectangularSelection(),
          crosshairCursor(),
          isMd ? [] : highlightActiveLine(),
          large ? [] : highlightSelectionMatches(),
          search({ top: true }),
          c.indent.of([indentUnit.of(indent.unit), EditorState.tabSize.of(indent.size)]),
          keymap.of([
            ...(isMd
              ? [
                  { key: "Mod-b", run: (v: EditorView) => toggleWrap(v, "**") },
                  { key: "Mod-i", run: (v: EditorView) => toggleWrap(v, "*") },
                  { key: "Mod-Shift-k", run: (v: EditorView) => insertLink(v) },
                  { key: "Mod-Alt-1", run: (v: EditorView) => setHeading(v, 1) },
                  { key: "Mod-Alt-2", run: (v: EditorView) => setHeading(v, 2) },
                  { key: "Mod-Alt-3", run: (v: EditorView) => setHeading(v, 3) },
                ]
              : []),
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
            ...completionKeymap,
            indentWithTab,
          ]),
          baseTheme,
          isMd ? Prec.high(proseTheme) : [],
          c.font.of(EditorView.theme({ ".cm-scroller": { fontSize: `${s.fontSize + (isMd ? 2 : 0)}px` } })),
          c.wrap.of(isMd || s.wordWrapCode ? EditorView.lineWrapping : []),
          c.lang.of(mdExt),
          c.live.of(isMd && s.markdownLivePreview && !large ? [livePreview(resolveImage), livePreviewTheme] : []),
          EditorView.contentAttributes.of({ "aria-label": host.name, spellcheck: isMd || /\.(txt|text)$/i.test(host.name) ? "true" : "false" }),
          EditorView.domEventHandlers({
            mousedown: (e, v) => {
              if (!(e.ctrlKey || e.metaKey) || !isMd) return false;
              const pos = v.posAtCoords({ x: e.clientX, y: e.clientY });
              if (pos == null) return false;
              let n = syntaxTree(v.state).resolveInner(pos, 1) as ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]> | null;
              while (n && n.name !== "Link" && n.name !== "Image" && n.name !== "URL") n = n.parent;
              if (!n) return false;
              const urlNode = n.name === "URL" ? n : n.getChild("URL");
              if (!urlNode) return false;
              e.preventDefault();
              host.openLink(v.state.sliceDoc(urlNode.from, urlNode.to).replace(/^<|>$/g, ""));
              return true;
            },
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) {
              const dirty = formatDirty.current || !u.state.doc.eq(baseline.current!);
              host.setDirty(dirty);
              if (dirty) host.changed();
              clearTimeout(outlineTimer);
              outlineTimer = window.setTimeout(() => {
                updateOutline(u.state);
                if (previewOpen.current) setPreviewText(u.state.doc.toString());
              }, 250);
            }
            if (u.docChanged || u.selectionSet) updateStatus(u.state);
          }),
        ],
      }),
    });
    viewRef.current = view;
    baseline.current = view.state.doc;

    // Language for non-Markdown files is loaded lazily.
    if (!isMd) {
      const desc = large ? null : detectLanguage(host.name, text.slice(0, 200).split("\n")[0] ?? "");
      if (desc) {
        langName.current = desc.name;
        void loadLanguage(desc).then((lang) => {
          if (lang && viewRef.current === view) view.dispatch({ effects: c.lang.reconfigure(lang) });
        });
      }
    }

    function chooseLanguage() {
      const common = ["Plain text", "JavaScript", "TypeScript", "Python", "JSON", "YAML", "TOML", "HTML", "CSS", "Markdown", "Rust", "Go", "Java", "C#", "C++", "C", "Shell", "PowerShell", "SQL", "XML", "PHP", "Ruby"];
      const items = common.map((name) => ({
        label: name,
        run: () => {
          if (name === "Plain text") {
            langName.current = name;
            view.dispatch({ effects: c.lang.reconfigure([]) });
            updateStatus(view.state);
            return;
          }
          const d = LanguageDescription.matchLanguageName(ALL_LANGUAGES, name, true);
          if (!d) return;
          langName.current = d.name;
          void loadLanguage(d).then((lang) => lang && view.dispatch({ effects: c.lang.reconfigure(lang) }));
          updateStatus(view.state);
        },
      }));
      openMenu(window.innerWidth - 260, window.innerHeight - 40 - Math.min(items.length * 30, window.innerHeight * 0.7), items);
    }
    function chooseEncoding() {
      const f = formatRef.current;
      const set = (patch: Partial<TextFormat>) => {
        formatRef.current = { ...f, ...patch };
        formatDirty.current = true;
        host.setDirty(true);
        host.changed();
        updateStatus(view.state);
      };
      openMenu(window.innerWidth - 300, window.innerHeight - 170, [
        { label: "Save as UTF-8", run: () => set({ encoding: "utf-8", bom: false }) },
        { label: "Save as UTF-8 with BOM", run: () => set({ encoding: "utf-8", bom: true }) },
        { label: "Save as UTF-16 LE", run: () => set({ encoding: "utf-16le", bom: true }) },
        { label: "Save as Windows 1252", run: () => set({ encoding: "windows-1252", bom: false }) },
      ]);
    }
    function toggleEol() {
      formatRef.current = { ...formatRef.current, eol: formatRef.current.eol === "\r\n" ? "\n" : "\r\n", mixedEol: false };
      formatDirty.current = true;
      host.setDirty(true);
      host.changed();
      updateStatus(view.state);
    }

    const md = (f: (v: EditorView) => boolean) => () => f(view);
    const commands: Command[] = [
      { id: "text.find", title: "Find and replace", group: "Edit", shortcut: "Ctrl+F", run: () => openSearchPanel(view) },
      { id: "text.wrap", title: "Wrap long lines", group: "View", run: () => toggleWrapLines() },
      { id: "text.language", title: "Set language (for colours and indentation)…", group: "View", run: chooseLanguage },
      // Rarely needed; grouped as Advanced so everyday lists stay short.
      { id: "text.eol", title: `Use ${formatRef.current.eol === "\r\n" ? "Unix (LF)" : "Windows (CRLF)"} line endings`, group: "Advanced", run: toggleEol },
      { id: "text.encoding", title: "Reopen or save with another text format…", group: "Advanced", run: chooseEncoding },
    ];
    if (isMd) {
      commands.push(
        { id: "md.bold", title: "Bold", group: "Format", shortcut: "Ctrl+B", run: md((v) => toggleWrap(v, "**")) },
        { id: "md.italic", title: "Italic", group: "Format", shortcut: "Ctrl+I", run: md((v) => toggleWrap(v, "*")) },
        { id: "md.strike", title: "Strikethrough", group: "Format", run: md((v) => toggleWrap(v, "~~")) },
        { id: "md.code", title: "Inline code", group: "Format", run: md((v) => toggleWrap(v, "`")) },
        { id: "md.h1", title: "Heading 1", group: "Format", shortcut: "Ctrl+Alt+1", run: md((v) => setHeading(v, 1)) },
        { id: "md.h2", title: "Heading 2", group: "Format", shortcut: "Ctrl+Alt+2", run: md((v) => setHeading(v, 2)) },
        { id: "md.h3", title: "Heading 3", group: "Format", shortcut: "Ctrl+Alt+3", run: md((v) => setHeading(v, 3)) },
        { id: "md.bullets", title: "Bulleted list", group: "Format", run: md((v) => toggleLinePrefix(v, "- ")) },
        { id: "md.numbers", title: "Numbered list", group: "Format", run: md((v) => toggleLinePrefix(v, "1. ")) },
        { id: "md.tasks", title: "Task list", group: "Format", run: md((v) => toggleLinePrefix(v, "- [ ] ")) },
        { id: "md.quote", title: "Quote", group: "Format", run: md((v) => toggleLinePrefix(v, "> ")) },
        { id: "md.link", title: "Insert link", group: "Insert", shortcut: "Ctrl+Shift+K", run: md((v) => insertLink(v)) },
        { id: "md.linkFile", title: "Insert link to a file…", group: "Insert", run: () => void linkToFile() },
        { id: "md.table", title: "Insert table", group: "Insert", run: md((v) => insertBlock(v, "| Column | Column |\n| --- | --- |\n|  |  |\n", 2, 6)) },
        { id: "md.codeblock", title: "Insert code block", group: "Insert", run: md((v) => insertBlock(v, "```\n\n```\n", 4)) },
        { id: "md.hr", title: "Insert divider", group: "Insert", run: md((v) => insertBlock(v, "---\n")) },
        { id: "md.preview", title: "Toggle side-by-side preview", group: "View", run: () => togglePreview() },
        { id: "md.live", title: "Toggle live formatting", group: "View", run: () => void import("../../app/actions").then((a) => a.updateSettings({ markdownLivePreview: !getState().settings.markdownLivePreview })) },
      );
    }

    async function linkToFile() {
      const [p] = await platform.pickOpen({ multiple: false });
      if (!p) return;
      const target = host.path ? relative(dirname(host.path), p) : p.replace(/\\/g, "/");
      insertLink(view, encodeURI(target));
    }
    function toggleWrapLines() {
      wrapOn.current = !wrapOn.current;
      view.dispatch({ effects: c.wrap.reconfigure(wrapOn.current ? EditorView.lineWrapping : []) });
    }
    function togglePreview() {
      previewOpen.current = !previewOpen.current;
      setPreview(previewOpen.current);
      if (previewOpen.current) setPreviewText(view.state.doc.toString());
      setToolbar();
    }

    const setToolbar = () => {
      const g = (id: string, label: string, icon: React.ReactNode, run: () => void, group: string, extra: Partial<ToolbarItem> = {}): ToolbarItem => ({ id, label, icon, run, group, ...extra });
      if (isMd) {
        host.setToolbar([
          g("h1", "Heading 1", <Heading1 />, md((v) => setHeading(v, 1)), "a", { shortcut: "Ctrl+Alt+1" }),
          g("h2", "Heading 2", <Heading2 />, md((v) => setHeading(v, 2)), "a", { shortcut: "Ctrl+Alt+2" }),
          g("b", "Bold", <Bold />, md((v) => toggleWrap(v, "**")), "b", { shortcut: "Ctrl+B" }),
          g("i", "Italic", <Italic />, md((v) => toggleWrap(v, "*")), "b", { shortcut: "Ctrl+I" }),
          g("code", "Inline code", <Code />, md((v) => toggleWrap(v, "`")), "b", { overflow: true }),
          g("ul", "Bulleted list", <List />, md((v) => toggleLinePrefix(v, "- ")), "c"),
          g("ol", "Numbered list", <ListOrdered />, md((v) => toggleLinePrefix(v, "1. ")), "c"),
          g("task", "Task list", <ListTodo />, md((v) => toggleLinePrefix(v, "- [ ] ")), "c"),
          g("quote", "Quote", <Quote />, md((v) => toggleLinePrefix(v, "> ")), "c", { overflow: true }),
          g("link", "Insert link", <Link2 />, md((v) => insertLink(v)), "d", { shortcut: "Ctrl+Shift+K" }),
          g("table", "Insert table", <Table />, md((v) => insertBlock(v, "| Column | Column |\n| --- | --- |\n|  |  |\n", 2, 6)), "d", { overflow: true }),
          g("hr", "Insert divider", <Minus />, md((v) => insertBlock(v, "---\n")), "d", { overflow: true }),
          g("preview", "Side-by-side preview", <Columns2 />, togglePreview, "e", { active: previewOpen.current }),
        ]);
      } else {
        host.setToolbar([
          g("wrap", "Word wrap", <WrapText />, toggleWrapLines, "a", { active: wrapOn.current }),
        ]);
      }
    };
    setToolbar();

    host.register({
      async serialize(opts) {
        const doc = view.state.doc;
        const textNow = doc.toString();
        let f = formatRef.current;
        if (!canEncode(textNow, f.encoding)) {
          if (!opts?.forSave) return encodeText(textNow, { ...f, encoding: "utf-8", bom: false });
          const { ask } = await import("../../app/dialogs");
          const choice = await ask(
            `Some characters can't be saved as ${describeFormat(f).encoding}`,
            "This file uses an older encoding that cannot hold some of the characters you typed. Saving as UTF-8 keeps them, but programs that expect the old encoding may show accented letters differently.",
            ["Save as UTF-8", "Replace them with ?", "Cancel"],
          );
          if (choice === "Save as UTF-8") f = formatRef.current = { ...f, encoding: "utf-8", bom: false };
          else if (choice !== "Replace them with ?") throw new Error("Save cancelled.");
          formatDirty.current = true;
        }
        // Only a real save may become the "saved" baseline (recovery and export copies must not).
        if (opts?.forSave) lastSerialized.current = doc;
        return encodeText(textNow, f);
      },
      markSaved() {
        if (!lastSerialized.current) return;
        baseline.current = lastSerialized.current;
        lastSerialized.current = null;
        formatRef.current = { ...formatRef.current, mixedEol: false };
        formatDirty.current = false;
        const dirty = !view.state.doc.eq(baseline.current!);
        if (dirty) {
          host.setDirty(true);
          host.changed();
        }
        updateStatus(view.state);
      },
      focus: () => view.focus(),
      find: () => openSearchPanel(view),
      zoom: (d) => {
        const cur = Number(ref.current?.dataset.zoom ?? 0);
        const next = d === 0 ? 0 : Math.max(-6, Math.min(16, cur + d * 2));
        if (ref.current) ref.current.dataset.zoom = String(next);
        view.dispatch({ effects: c.font.reconfigure(EditorView.theme({ ".cm-scroller": { fontSize: `${getState().settings.fontSize + (isMd ? 2 : 0) + next}px` } })) });
      },
      goTo: (loc) => {
        const n = Math.max(1, Math.min(view.state.doc.lines, parseInt(loc, 10) || 1));
        const line = view.state.doc.line(n);
        view.dispatch({ selection: { anchor: line.from }, effects: EditorView.scrollIntoView(line.from, { y: "center" }) });
        view.focus();
      },
      getText: () => view.state.doc.toString(),
      viewState: () => ({ anchor: view.state.selection.main.anchor, scroll: view.scrollDOM.scrollTop }),
      commands: () => commands,
    });

    // Restore cursor and scroll from the last session.
    const vs = host.viewState as { anchor?: number; scroll?: number } | undefined;
    if (vs?.anchor != null && vs.anchor <= view.state.doc.length) {
      view.dispatch({ selection: { anchor: vs.anchor } });
      requestAnimationFrame(() => (view.scrollDOM.scrollTop = vs.scroll ?? 0));
    }
    updateOutline(view.state);
    updateStatus(view.state);
    if (!host.bytes.length || !host.path) view.focus();

    return () => {
      clearTimeout(outlineTimer);
      view.destroy();
      viewRef.current = null;
      imageCache.current.forEach((u) => URL.revokeObjectURL(u));
    };
    // The editor is created once per mount; settings are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply settings changes without recreating the editor.
  useEffect(() => {
    const v = viewRef.current;
    if (!v) return;
    const c = comps.current;
    const zoom = Number(ref.current?.dataset.zoom ?? 0);
    v.dispatch({
      effects: [
        c.font.reconfigure(EditorView.theme({ ".cm-scroller": { fontSize: `${settings.fontSize + (isMd ? 2 : 0) + zoom}px` } })),
        c.gutter.reconfigure(!isMd && settings.lineNumbers ? [lineNumbers(), foldGutter(), highlightActiveLineGutter()] : []),
        c.live.reconfigure(isMd && settings.markdownLivePreview && v.state.doc.length < LARGE ? [livePreview(resolveImage), livePreviewTheme] : []),
      ],
    });
  }, [settings.fontSize, settings.lineNumbers, settings.markdownLivePreview, isMd]);

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex" }}>
      <div ref={ref} style={{ flex: 1, minWidth: 0, height: "100%" }} />
      {preview && (
        <MarkdownPreview
          text={previewText}
          basePath={host.path}
          onLink={(t) => host.openLink(t)}
          resolveImage={resolveImage}
          scrollSource={viewRef.current?.scrollDOM ?? null}
        />
      )}
    </div>
  );
}
