import { Share, MoreHorizontal } from "lucide-react";
import { Fragment } from "react";
import { useStore, setState } from "../app/store";
import type { ToolbarItem } from "../app/editor-api";
import { openMenu } from "./Menu";

export function Toolbar() {
  const activeId = useStore((s) => s.activeId);
  const items = useStore((s) => (s.activeId ? s.toolbar[s.activeId] : undefined)) ?? [];
  const tab = useStore((s) => s.tabs.find((t) => t.id === s.activeId));
  if (!activeId || !tab) return <div className="toolbar" />;
  // Office files bring their own ribbon; an empty app toolbar above it would only take space.
  if (!items.length && (tab.kind === "docx" || tab.kind === "xlsx" || tab.kind === "pptx")) return <div className="toolbar empty" aria-hidden />;

  const groups: ToolbarItem[][] = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last[0].group === it.group) last.push(it);
    else groups.push([it]);
  }
  const overflow = items.filter((i) => i.overflow);

  return (
    <div className="toolbar" role="toolbar" aria-label={`${tab.name} tools`}>
      {groups.map((g, gi) => (
        <Fragment key={gi}>
          {gi > 0 && <span className={`divider ${g.every((i) => i.overflow) ? "overflow-item" : ""}`} />}
          <div className="group">
            {g.map((it) => (
              <button
                key={it.id}
                className={`icon-btn ${it.active ? "active" : ""} ${it.overflow ? "overflow-item" : ""}`}
                title={it.shortcut ? `${it.label} (${it.shortcut})` : it.label}
                aria-label={it.label}
                aria-pressed={it.active}
                disabled={it.disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={it.run}
              >
                {it.icon}
                {it.text && <span>{it.text}</span>}
              </button>
            ))}
          </div>
        </Fragment>
      ))}
      <span className="spacer" />
      {overflow.length > 0 && (
        <button
          className="icon-btn more-btn"
          title="More"
          aria-label="More tools"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            openMenu(r.left - 160, r.bottom + 4, overflow.map((o) => ({ label: o.label, shortcut: o.shortcut, run: o.run, disabled: o.disabled })));
          }}
        >
          <MoreHorizontal />
        </button>
      )}
      <button className="icon-btn" title="Export (Ctrl+E)" onClick={() => setState({ dialog: { kind: "export" } })}>
        <Share /> <span>Export</span>
      </button>
    </div>
  );
}
