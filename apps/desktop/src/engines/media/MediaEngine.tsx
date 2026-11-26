import { useEffect, useMemo, useState } from "react";
import { ExternalLink, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import type { EngineHost } from "../../app/editor-api";
import { platform } from "../../platform";
import { extname } from "../../lib/paths";
import { VIDEO } from "../../lib/formats";

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif", svg: "image/svg+xml",
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", oga: "audio/ogg", opus: "audio/ogg", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac",
  mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", ogv: "video/ogg", mov: "video/quicktime",
};

function hexDump(bytes: Uint8Array, limit = 64 * 1024): string {
  const lines: string[] = [];
  const n = Math.min(bytes.length, limit);
  for (let i = 0; i < n; i += 16) {
    const chunk = bytes.subarray(i, Math.min(i + 16, n));
    const hex = Array.from(chunk, (b) => b.toString(16).padStart(2, "0")).join(" ").padEnd(47, " ");
    const ascii = Array.from(chunk, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join("");
    lines.push(`${i.toString(16).padStart(8, "0")}  ${hex}  ${ascii}`);
  }
  return lines.join("\n");
}

export default function MediaEngine({ host }: { host: EngineHost }) {
  const isImage = host.kind === "image";
  const isMedia = host.kind === "media";
  const url = useMemo(() => (isImage || isMedia ? URL.createObjectURL(new Blob([host.bytes.slice()], { type: MIME[extname(host.name)] ?? "application/octet-stream" })) : ""), [host, isImage, isMedia]);
  const [unplayable, setUnplayable] = useState(false);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  useEffect(() => {
    host.register({
      canSave: false,
      serialize: async () => host.bytes,
      focus: () => {},
      zoom: (d) => setZoom((z) => (d === 0 ? "fit" : Math.max(0.1, Math.min(8, (z === "fit" ? 1 : z) * (d > 0 ? 1.25 : 0.8))))),
    });
    host.setToolbar(
      isImage
        ? [
            { id: "fit", label: "Fit to window", icon: <Maximize />, run: () => setZoom("fit"), group: "z", active: zoom === "fit" },
            { id: "zout", label: "Zoom out", icon: <ZoomOut />, run: () => setZoom((z) => Math.max(0.1, (z === "fit" ? 1 : z) * 0.8)), group: "z" },
            { id: "zin", label: "Zoom in", icon: <ZoomIn />, run: () => setZoom((z) => Math.min(8, (z === "fit" ? 1 : z) * 1.25)), group: "z" },
          ]
        : [],
    );
    host.setStatus([
      { id: "size", text: `${(host.bytes.length / 1024).toFixed(1)} KB` },
      ...(size ? [{ id: "dim", text: `${size.w} × ${size.h} px` }] : []),
      ...(isImage ? [{ id: "zoom", text: zoom === "fit" ? "Fit" : `${Math.round(zoom * 100)}%`, align: "right" as const }] : []),
    ]);
  }, [host, isImage, zoom, size]);

  if (isMedia) {
    const video = VIDEO.has(extname(host.name));
    if (unplayable)
      return (
        <div className="center-note">
          <h3>{host.name} can't be played here</h3>
          <div>Its sound or picture is stored in a way this player doesn't support.</div>
          {host.path && platform.folders && (
            <div className="acts">
              <button className="btn" onClick={() => void platform.openExternal(host.path!)}><ExternalLink size={14} /> Open in default app</button>
            </div>
          )}
        </div>
      );
    return (
      <div className="media-view">
        {video ? (
          <video src={url} controls preload="metadata" aria-label={host.name} onError={() => setUnplayable(true)} onLoadedMetadata={(e) => setSize({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })} />
        ) : (
          <div className="audio-card">
            <div className="t">{host.name}</div>
            <audio src={url} controls preload="metadata" aria-label={host.name} onError={() => setUnplayable(true)} />
          </div>
        )}
      </div>
    );
  }

  if (isImage)
    return (
      <div className="image-view">
        <img
          src={url}
          alt={host.name}
          onLoad={(e) => setSize({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
          style={zoom === "fit" ? { maxWidth: "100%", maxHeight: "100%" } : { width: (size?.w ?? 0) * zoom }}
        />
      </div>
    );

  return (
    <div className="binary-view">
      <div className="banner">
        <span className="msg">This looks like a binary file, so it is shown as bytes (read-only{host.bytes.length > 65536 ? ", first 64 KB" : ""}).</span>
        {host.path && <button className="btn" onClick={() => void platform.openExternal(host.path!)}><ExternalLink size={14} /> Open in default app</button>}
        <button className="btn" onClick={() => host.openAs("text")}>Open as text anyway</button>
      </div>
      <pre className="hex">{hexDump(host.bytes)}</pre>
    </div>
  );
}
