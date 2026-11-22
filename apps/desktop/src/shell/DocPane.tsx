import { Suspense, useMemo, Component, type ReactNode } from "react";
import { Info, TriangleAlert, FileWarning } from "lucide-react";
import { setState, updateTab, handles, tabBytes, toast, type Tab } from "../app/store";
import { contentChanged, keepMine, reloadFromDisk, saveTab, closeTab, openLink, reopenAs, takePendingGoTo, engineSetDirty } from "../app/actions";
import type { EngineHost } from "../app/editor-api";
import { engineFor } from "../engines";
import { platform } from "../platform";

class EngineBoundary extends Component<{ children: ReactNode; tab: Tab }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
  render() {
    if (!this.state.error) return this.props.children;
    const { tab } = this.props;
    return (
      <div className="center-note">
        <FileWarning size={28} />
        <h3>This file could not be shown</h3>
        <div>{this.state.error}</div>
        <div className="acts">
          {tab.kind !== "text" && <button className="btn" onClick={() => void reopenAs(tab.id, "text")}>Open as text</button>}
          {tab.path && <button className="btn" onClick={() => void platform.openExternal(tab.path!)}>Open in default app</button>}
          <button className="btn subtle" onClick={() => void closeTab(tab.id)}>Close</button>
        </div>
      </div>
    );
  }
}

function Banner({ tab }: { tab: Tab }) {
  if (tab.conflict === "changed")
    return (
      <div className="banner warn" role="alert">
        <TriangleAlert />
        <span className="msg">This file was changed by another program while you had unsaved edits here.</span>
        <button className="btn" onClick={() => void reloadFromDisk(tab.id)}>Load theirs</button>
        <button className="btn" onClick={() => keepMine(tab.id)}>Keep mine</button>
      </div>
    );
  if (tab.conflict === "deleted")
    return (
      <div className="banner warn" role="alert">
        <TriangleAlert />
        <span className="msg">This file was moved or deleted outside the app. Your content is still here.</span>
        <button className="btn" onClick={() => void saveTab(tab.id, { explicit: true })}>Save to recreate</button>
        <button className="btn" onClick={() => void saveTab(tab.id, { as: true, explicit: true })}>Save as…</button>
      </div>
    );
  if (tab.notice)
    return (
      <div className={`banner ${tab.notice.tone === "warn" ? "warn" : ""}`}>
        <Info />
        <span className="msg">{tab.notice.text}</span>
        <button className="btn subtle" onClick={() => updateTab(tab.id, { notice: undefined })}>Dismiss</button>
      </div>
    );
  return null;
}

function EngineMount({ tab }: { tab: Tab }) {
  const Engine = engineFor(tab.kind);
  const host = useMemo<EngineHost>(
    () => ({
      tabId: tab.id,
      path: tab.path,
      name: tab.name,
      kind: tab.kind,
      bytes: tabBytes.get(tab.id) ?? new Uint8Array(),
      viewState: tab.viewState,
      setDirty: (dirty) => engineSetDirty(tab.id, dirty),
      changed: () => contentChanged(tab.id),
      setToolbar: (items) => setState((s) => ({ toolbar: { ...s.toolbar, [tab.id]: items } })),
      setStatus: (items) => setState((s) => ({ status: { ...s.status, [tab.id]: items } })),
      setOutline: (items) => setState((s) => ({ outline: { ...s.outline, [tab.id]: items } })),
      register: (h) => {
        handles.set(tab.id, h);
        const loc = takePendingGoTo(tab.id);
        if (loc) setTimeout(() => h.goTo?.(loc), 30);
      },
      openLink: (target) => openLink(tab, target),
      toast: (m, k) => toast(m, k),
      openAs: (kind) => void reopenAs(tab.id, kind),
      save: () => void saveTab(tab.id, { explicit: true }),
    }),
    // Recreate the host when the engine is remounted with new content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tab.id, tab.version, tab.kind],
  );
  // Keep host path/name current without remounting (after Save As).
  host.path = tab.path;
  host.name = tab.name;
  return (
    <EngineBoundary tab={tab}>
      <Suspense fallback={<div className="center-note"><div className="spinner" /></div>}>
        <Engine key={`${tab.version}-${tab.kind}`} host={host} />
      </Suspense>
    </EngineBoundary>
  );
}

export function DocPane({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <section className="doc-pane" hidden={!active} aria-label={tab.name}>
      <Banner tab={tab} />
      <div className="engine">
        {tab.loading ? (
          <div className="center-note"><div className="spinner" /></div>
        ) : tab.error ? (
          <div className="center-note">
            <FileWarning size={28} />
            <h3>{tab.name} could not be opened</h3>
            <div>{tab.error}</div>
            <div className="acts">
              {tab.path && <button className="btn" onClick={() => void platform.reveal(tab.path!)}>Show in folder</button>}
              <button className="btn subtle" onClick={() => void closeTab(tab.id)}>Close</button>
            </div>
          </div>
        ) : (
          <EngineMount tab={tab} />
        )}
      </div>
    </section>
  );
}
