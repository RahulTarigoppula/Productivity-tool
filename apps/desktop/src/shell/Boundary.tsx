/** Error boundaries for the parts of the window. A bug in one panel shows a small notice in that
 *  panel (with a way to retry); the documents and everything else keep working. */
import { Component, Fragment, type ReactNode } from "react";
import { TriangleAlert, RotateCcw } from "lucide-react";
import { reportError } from "../app/errors";

interface Props {
  /** Shown in the notice and the log, e.g. "sidebar". */
  name: string;
  children: ReactNode;
  /** "inline" for bars and panels; "page" for the whole window. */
  variant?: "inline" | "page" | "silent";
}

export class Boundary extends Component<Props, { error: Error | null; key: number }> {
  state = { error: null as Error | null, key: 0 };

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: unknown) {
    reportError(this.props.name, error, { quiet: true });
    // Overlays (palette, dialogs, menus) have no room for a notice: try again quietly, a few times.
    if (this.props.variant === "silent" && this.state.key < 3) window.setTimeout(this.retry, 400);
  }

  retry = () => this.setState((s) => ({ error: null, key: s.key + 1 }));

  render() {
    const { error, key } = this.state;
    const { name, variant = "inline", children } = this.props;
    if (!error) return <Fragment key={key}>{children}</Fragment>;
    if (variant === "silent") return null;
    if (variant === "page")
      return (
        <div className="crash-page" role="alert">
          <TriangleAlert />
          <h2>The window hit a problem</h2>
          <p>Your unsaved changes are kept by crash recovery and come back when the window reloads.</p>
          <pre>{error.message}</pre>
          <div className="acts">
            <button className="btn primary" onClick={() => window.location.reload()}>Reload window</button>
            <button className="btn" onClick={this.retry}>Try again</button>
          </div>
        </div>
      );
    return (
      <div className="panel-error" role="alert">
        <TriangleAlert />
        <span>The {name} hit a problem.</span>
        <button className="btn sm" onClick={this.retry}><RotateCcw /> Retry</button>
      </div>
    );
  }
}
