import { useEffect, useRef, useState } from "react";
import { platform } from "../../platform";

const toBytes = (dataUrl: string) => Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));

/** Draw or type a signature once, keep it for next time, and hand back a transparent PNG. */
export function SignaturePad({ onDone, onCancel }: { onDone: (png: Uint8Array) => void; onCancel: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mode, setMode] = useState<"draw" | "type" | "saved">("draw");
  const [typed, setTyped] = useState("");
  const [saved, setSaved] = useState<string[]>([]);
  const [empty, setEmpty] = useState(true);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    void platform.stateGet("signatures").then((s) => {
      const list = s ? (JSON.parse(s) as string[]) : [];
      setSaved(list);
      if (list.length) setMode("saved");
    });
  }, []);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (mode === "type" && typed) {
      ctx.fillStyle = "#1a237e";
      ctx.font = `italic 64px "Segoe Script", "Brush Script MT", "Lucida Handwriting", cursive`;
      ctx.textBaseline = "middle";
      ctx.fillText(typed, 20, c.height / 2, c.width - 40);
      setEmpty(false);
    } else if (mode === "type") setEmpty(true);
  }, [mode, typed]);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * canvas.current!.width, y: ((e.clientY - r.top) / r.height) * canvas.current!.height };
  };

  const trimmedPng = (): Uint8Array | null => {
    const c = canvas.current!;
    const ctx = c.getContext("2d")!;
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 10) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    if (x1 <= x0 || y1 <= y0) return null;
    const pad = 8;
    const out = document.createElement("canvas");
    out.width = x1 - x0 + pad * 2;
    out.height = y1 - y0 + pad * 2;
    out.getContext("2d")!.drawImage(c, x0 - pad, y0 - pad, out.width, out.height, 0, 0, out.width, out.height);
    return toBytes(out.toDataURL("image/png"));
  };

  const use = async (remember: boolean) => {
    const png = trimmedPng();
    if (!png) return;
    if (remember) {
      const url = "data:image/png;base64," + btoa(String.fromCharCode(...png));
      const list = [url, ...saved.filter((s) => s !== url)].slice(0, 5);
      await platform.stateSet("signatures", JSON.stringify(list));
    }
    onDone(png);
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="dialog" style={{ width: "min(620px, calc(100vw - 32px))" }} role="dialog" aria-label="Signature">
        <h3>Your signature</h3>
        <p>This places a picture of your signature on the page — not a certificate-based digital signature.</p>
        <div className="side-head" style={{ padding: "0 0 10px" }}>
          <div className="seg">
            {saved.length > 0 && <button className={`icon-btn ${mode === "saved" ? "active" : ""}`} onClick={() => setMode("saved")}>Saved</button>}
            <button className={`icon-btn ${mode === "draw" ? "active" : ""}`} onClick={() => { setMode("draw"); setEmpty(true); }}>Draw</button>
            <button className={`icon-btn ${mode === "type" ? "active" : ""}`} onClick={() => setMode("type")}>Type</button>
          </div>
        </div>
        {mode === "saved" ? (
          <div style={{ display: "grid", gap: 8 }}>
            {saved.map((s, i) => (
              <div key={i} className="export-row" role="button" tabIndex={0} onClick={() => onDone(toBytes(s))}>
                <img src={s} alt="Saved signature" style={{ maxHeight: 60, maxWidth: "70%", background: "#fff", borderRadius: 4 }} />
                <span className="desc" />
                <button className="btn subtle" onClick={(e) => { e.stopPropagation(); const list = saved.filter((x) => x !== s); setSaved(list); void platform.stateSet("signatures", JSON.stringify(list)); }}>Remove</button>
              </div>
            ))}
          </div>
        ) : (
          <>
            {mode === "type" && <input className="input" autoFocus placeholder="Type your name" value={typed} onChange={(e) => setTyped(e.target.value)} style={{ marginBottom: 8 }} />}
            <canvas
              ref={canvas}
              width={1000}
              height={300}
              className="sig-canvas"
              onPointerDown={(e) => {
                if (mode !== "draw") return;
                drawing.current = true;
                last.current = pos(e);
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (!drawing.current || mode !== "draw") return;
                const p = pos(e);
                const ctx = canvas.current!.getContext("2d")!;
                ctx.strokeStyle = "#1a237e";
                ctx.lineWidth = 2 + (e.pressure || 0.5) * 4;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(last.current!.x, last.current!.y);
                ctx.lineTo(p.x, p.y);
                ctx.stroke();
                last.current = p;
                setEmpty(false);
              }}
              onPointerUp={() => (drawing.current = false)}
            />
          </>
        )}
        <div className="acts">
          {mode === "draw" && <button className="btn subtle" onClick={() => { canvas.current!.getContext("2d")!.clearRect(0, 0, 1000, 300); setEmpty(true); }}>Clear</button>}
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onCancel}>Cancel</button>
          {mode !== "saved" && <button className="btn" disabled={empty} onClick={() => void use(false)}>Use once</button>}
          {mode !== "saved" && <button className="btn primary" disabled={empty} onClick={() => void use(true)}>Save and use</button>}
        </div>
      </div>
    </div>
  );
}
