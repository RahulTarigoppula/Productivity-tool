import { lazy, type ComponentType } from "react";
import type { Kind } from "../lib/formats";
import type { EngineHost } from "../app/editor-api";

export type EngineComponent = ComponentType<{ host: EngineHost }>;

const TextEngine = lazy(() => import("./text/TextEngine"));
const CsvEngine = lazy(() => import("./csv/CsvEngine"));
const PdfEngine = lazy(() => import("./pdf/PdfEngine"));
const OfficeEngine = lazy(() => import("./office/OfficeEngine"));
const MediaEngine = lazy(() => import("./media/MediaEngine"));
const ArchiveEngine = lazy(() => import("./archive/ArchiveEngine"));

export function engineFor(kind: Kind): EngineComponent {
  switch (kind) {
    case "text":
    case "markdown":
      return TextEngine;
    case "csv":
      return CsvEngine;
    case "pdf":
      return PdfEngine;
    case "docx":
    case "xlsx":
    case "pptx":
      return OfficeEngine;
    case "archive":
      return ArchiveEngine;
    default:
      return MediaEngine;
  }
}
