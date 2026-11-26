import { useEffect, useRef, useState } from "react";
import { Check, Loader2, CircleAlert, Pencil, History, Lock } from "lucide-react";
import { useStore, setState, getState, type Tab } from "../app/store";
import type { StatusItem } from "../app/editor-api";
import { useMenuOpenerId } from "./Menu";

function SaveState({ tab }: { tab: Tab }) {
  const historyOpen = useStore((st) => st.rightOpen && st.rightView === "history");
  const map: Record<Tab["saveState"], { icon: React.ReactNode; text: string }> = {
    new: { icon: <Pencil />, text: "Not saved yet" },
    saved: { icon: <Check />, text: "Saved" },
    saving: { icon: <Loader2 className="spin" />, text: "Saving…" },
    edited: { icon: <Pencil />, text: "Edited" },
    failed: { icon: <CircleAlert />, text: "Save failed" },
    recovered: { icon: <History />, text: "Recovered — not saved" },
    readonly: { icon: <Lock />, text: "Read-only" },
  };
  const s = tab.dirty && tab.saveState === "saved" ? map.edited : map[tab.saveState];
  return (
    <button
      className={`item save-state ${tab.saveState}`}
      title="Version history"
      aria-label={`${s.text}, version history`}
      aria-expanded={historyOpen}
      onClick={() => setState((st) => ({ rightOpen: !(st.rightOpen && st.rightView === "history"), rightView: "history" }))}
    >
      {s.icon}
      {s.text}
    </button>
  );
}

/** Save results for screen readers. The text only changes when there is news, and only changes
 *  are read out: the first save, a failure, a save that takes more than a second, and the save
 *  after those. Auto-saves while someone types stay quiet, and so does switching tabs. */
function SaveAnnouncer({ tab }: { tab: Tab | undefined }) {
  const [text, setText] = useState("");
  const last = useRef<{ id?: string; state?: Tab["saveState"] }>({});
  const id = tab?.id;
  const state = tab?.saveState;
  useEffect(() => {
    const prev = last.current;
    last.current = { id, state };
    if (prev.id !== id) {
      setText("");
      return;
    }
    if (state === "failed") setText("Save failed");
    else if (state === "saved" && prev.state === "saving") setText("Saved");
    else if (state === "saving") {
      const t = window.setTimeout(() => setText("Saving…"), 1000);
      return () => window.clearTimeout(t);
    }
  }, [id, state]);
  return (
    <span className="sr-only" role="status">
      {text}
    </span>
  );
}

/** What React keeps of the engine's status items: no click handlers, which are looked up when an
 *  item is clicked. React holds on to its previous render, and a handler (a closure over the
 *  document) would keep a closed file's whole content in memory. */
type ItemView = Omit<StatusItem, "onClick"> & { clickable: boolean };
const views = new WeakMap<StatusItem[], ItemView[]>();
const NONE: ItemView[] = [];
function itemViews(items: StatusItem[] | undefined): ItemView[] {
  if (!items) return NONE;
  let v = views.get(items);
  if (!v) views.set(items, (v = items.map(({ onClick, ...view }) => ({ ...view, clickable: !!onClick }))));
  return v;
}
function clickItem(id: string) {
  const s = getState();
  (s.activeId ? s.status[s.activeId] : undefined)?.find((i) => i.id === id)?.onClick?.();
}

// What clicking an engine's status item does, where its short text does not say (the PDF zoom
// figure fits the page to the width; the page and line numbers open Go to). The spoken name keeps
// the words shown, so voice control finds it.
const CLICKS: Record<string, { name: (text: string) => string; title: string }> = {
  zoom: { name: (t) => `Zoom ${t}, fit to width`, title: "Fit to width" },
  page: { name: (t) => `${t}, go to page`, title: "Go to page" },
  pos: { name: (t) => `${t}, go to line`, title: "Go to line" },
};

export function StatusBar() {
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeId));
  const items = useStore((s) => itemViews(s.activeId ? s.status[s.activeId] : undefined));
  const menuOpener = useMenuOpenerId();
  const middle = items.filter((i) => (i.align ?? "middle") === "middle");
  const right = items.filter((i) => i.align === "right");
  const item = (i: ItemView, className: string) => {
    if (!i.clickable)
      return (
        <span key={i.id} className={className} title={i.title}>
          {i.text}
        </span>
      );
    const click = CLICKS[i.id];
    // Engines show a file's details (language, text format, line endings) in a menu.
    const menu = i.id === "details";
    const id = `status-${i.id}`;
    return (
      <button
        key={i.id}
        id={id}
        className={className}
        title={i.title ?? click?.title}
        aria-label={click?.name(i.text)}
        aria-haspopup={menu ? "menu" : undefined}
        aria-expanded={menu ? menuOpener === id : undefined}
        onClick={() => clickItem(i.id)}
      >
        {i.text}
      </button>
    );
  };
  return (
    <footer className="statusbar" aria-label="Status">
      {/* Nothing to report on the home screen. */}
      {tab && (tab.error ? <span className="item">Not opened</span> : <SaveState tab={tab} />)}
      <SaveAnnouncer tab={tab} />
      {middle.map((i) => item(i, "item middle"))}
      <span className="spacer" />
      {right.map((i) => item(i, "item"))}
    </footer>
  );
}
