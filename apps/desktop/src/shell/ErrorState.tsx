import { FileWarning, ExternalLink } from "lucide-react";
import type { ReactNode } from "react";
import { closeTab, explainError } from "../app/actions";
import { platform } from "../platform";

/** The one way a file that cannot be shown is explained: an icon, a plain sentence (library
 *  messages are put in everyday words), and what can be done next. */
export function ErrorState({ tabId, path, title, message, children }: { tabId: string; path: string | null; title: string; message: string; children?: ReactNode }) {
  return (
    <div className="center-note" role="alert">
      <FileWarning size={28} />
      <h3>{title}</h3>
      <div>{explainError(message)}</div>
      <div className="acts">
        {children}
        {path && platform.folders && (
          <button className="btn" onClick={() => void platform.openExternal(path).catch(() => {})}>
            <ExternalLink size={14} /> Open in default app
          </button>
        )}
        <button className="btn subtle" onClick={() => void closeTab(tabId)}>Close</button>
      </div>
    </div>
  );
}
