import { useEffect, useRef, useState } from "react";
import { markdownToHtml } from "../../app/exporters";

export function MarkdownPreview({ text, onLink, resolveImage, scrollSource }: { text: string; basePath: string | null; onLink: (t: string) => void; resolveImage: (src: string) => Promise<string | null>; scrollSource: HTMLElement | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState("");
  useEffect(() => {
    let live = true;
    void markdownToHtml(text).then((h) => live && setHtml(h));
    return () => {
      live = false;
    };
  }, [text]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src");
      if (src && !/^(https?:|data:|blob:)/.test(src)) void resolveImage(src).then((u) => u && (img.src = u));
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
