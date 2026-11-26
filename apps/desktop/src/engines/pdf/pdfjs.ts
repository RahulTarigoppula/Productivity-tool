/** Load PDF.js once, with its worker and offline assets. */
import { OLD_WEBVIEW } from "../../polyfills";

type PdfjsLib = typeof import("pdfjs-dist");
type PdfViewerLib = typeof import("pdfjs-dist/web/pdf_viewer.mjs");
export type Viewer = InstanceType<PdfViewerLib["PDFViewer"]>;
export type Bus = InstanceType<PdfViewerLib["EventBus"]>;

let lib: Promise<PdfjsLib> | null = null;
let viewer: Promise<PdfViewerLib> | null = null;

export const PDF_ASSETS = {
  cMapUrl: "/vendor/pdfjs/cmaps/",
  cMapPacked: true,
  standardFontDataUrl: "/vendor/pdfjs/standard_fonts/",
  wasmUrl: "/vendor/pdfjs/wasm/",
  iccUrl: "/vendor/pdfjs/iccs/",
  // The app's content security policy forbids eval; PDF.js has a non-eval path for fonts.
  isEvalSupported: false,
};

/** PDF.js's main build targets current browsers. Older system WebViews (Android phones that have
 *  not updated it) get the legacy build, which carries its own polyfills. */
export function needsLegacyPdfjs(): boolean {
  return OLD_WEBVIEW;
}

export function loadPdfjs(): Promise<PdfjsLib> {
  return (lib ??= (async () => {
    const legacy = needsLegacyPdfjs();
    const pdfjs = (legacy ? await import("pdfjs-dist/legacy/build/pdf.mjs") : await import("pdfjs-dist")) as PdfjsLib;
    const worker = legacy
      ? (await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url")).default
      : (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = worker;
    (globalThis as unknown as { pdfjsLib: PdfjsLib }).pdfjsLib = pdfjs;
    const getDocument = pdfjs.getDocument;
    // Always pass the offline asset locations.
    const wrapped = ((src: Parameters<typeof getDocument>[0]) =>
      getDocument({ ...PDF_ASSETS, ...(src as object) } as Parameters<typeof getDocument>[0])) as typeof getDocument;
    return { ...pdfjs, getDocument: wrapped } as PdfjsLib;
  })());
}

export function loadViewer(): Promise<PdfViewerLib> {
  return (viewer ??= (async () => {
    await loadPdfjs();
    await import("pdfjs-dist/web/pdf_viewer.css");
    if (needsLegacyPdfjs()) return (await import("pdfjs-dist/legacy/web/pdf_viewer.mjs")) as unknown as PdfViewerLib;
    return import("pdfjs-dist/web/pdf_viewer.mjs");
  })());
}
