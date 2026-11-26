import { FileText, FileCode2, Sheet, FileType2, FileImage, File, Presentation, FileSpreadsheet, NotebookText, FileVideo, FileArchive } from "lucide-react";
import type { Kind } from "../lib/formats";
import { extname } from "../lib/paths";

const CODE = new Set(["js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "h", "hpp", "cs", "rb", "php", "swift", "kt", "sh", "ps1", "json", "yaml", "yml", "toml", "xml", "html", "css", "scss", "sql", "lua", "r", "dart", "vue", "svelte"]);

export function KindIcon({ kind, name, className }: { kind: Kind; name?: string; className?: string }) {
  const style = { color: `var(--k-${kind === "binary" ? "text" : kind === "media" ? "image" : kind === "archive" ? "text" : kind})` };
  const p = { className: className ?? "kind", style, strokeWidth: 1.8 };
  switch (kind) {
    case "markdown": return <NotebookText {...p} />;
    case "csv": return <Sheet {...p} />;
    case "pdf": return <FileType2 {...p} />;
    case "docx": return <FileText {...p} />;
    case "xlsx": return <FileSpreadsheet {...p} />;
    case "pptx": return <Presentation {...p} />;
    case "image": return <FileImage {...p} />;
    case "media": return <FileVideo {...p} />;
    case "archive": return <FileArchive {...p} />;
    case "binary": return <File {...p} />;
    default:
      return name && CODE.has(extname(name)) ? <FileCode2 {...p} /> : <FileText {...p} />;
  }
}
