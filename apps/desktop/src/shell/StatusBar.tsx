import { Check, Loader2, CircleAlert, Pencil, History, Lock } from "lucide-react";
import { useStore, setState, type Tab } from "../app/store";

function SaveState({ tab }: { tab: Tab }) {
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
      onClick={() => setState((st) => ({ rightOpen: !(st.rightOpen && st.rightView === "history"), rightView: "history" }))}
    >
      {s.icon}
      {s.text}
    </button>
  );
}

export function StatusBar() {
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeId));
  const items = useStore((s) => (s.activeId ? s.status[s.activeId] : undefined)) ?? [];
  const middle = items.filter((i) => (i.align ?? "middle") === "middle");
  const right = items.filter((i) => i.align === "right");
  return (
    <footer className="statusbar" aria-label="Status">
      {tab ? <SaveState tab={tab} /> : <span className="item">Ready</span>}
      {middle.map((i) =>
        i.onClick ? (
          <button key={i.id} className="item middle" title={i.title} onClick={i.onClick}>{i.text}</button>
        ) : (
          <span key={i.id} className="item middle" title={i.title}>{i.text}</span>
        ),
      )}
      <span className="spacer" />
      {right.map((i) =>
        i.onClick ? (
          <button key={i.id} className="item" title={i.title} onClick={i.onClick}>{i.text}</button>
        ) : (
          <span key={i.id} className="item" title={i.title}>{i.text}</span>
        ),
      )}
    </footer>
  );
}
