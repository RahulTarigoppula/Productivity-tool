import { useEffect, useRef, useState } from "react";
import { markdownToHtml } from "../../app/exporters";

export function MarkdownPreview({ text, onLink, resolveImage, scrollSource }: { text: string; basePath: string | null; onLink: (t: string) => void; resolveImage: (src: string) => Promise<string | null>; scrollSource: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState("");
  useEffect(() => {
    let live = true;
    void markdownToHtml(text)
      .then((h) => live && setHtml(h))
      .catch((e) => live && setHtml(`<p><em>${String(e?.message ?? e).replace(/[<&>]/g, "")}</em></p>`));
    return () => {
      live = false;
    };
  }, [text]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll("img[data-src]").forEach((img) => {
      const src = img.getAttribute("data-src") ?? "";
      void resolveImage(src).then((u) => {
        if (u) img.setAttribute("src", u);
        else img.setAttribute("alt", `Image not loaded: ${src.slice(0, 80)}`);
      });
    });
  }, [html, resolveImage]);
  useEffect(() => {
    if (!scrollSource) return;
    const sync = () => {
      const el = ref.current;
      if (!el) return;
      const ratio = scrollSource.scrollTop / Math.max(1, scrollSource.scrollHeight - scrollSource.clientHeight);
      el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
    };
    scrollSource.addEventListener("scroll", sync, { passive: true });
    return () => scrollSource.removeEventListener("scroll", sync);
  }, [scrollSource]);
  return (
    <div
      ref={ref}
      className="md-preview"
      data-links="app"
      aria-label="Preview"
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (a) {
          e.preventDefault();
          const href = a.getAttribute("href");
          if (href) onLink(href);
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
