/** Load PDF.js once, with its worker and offline assets. */
type PdfjsLib = typeof import("pdfjs-dist");
type PdfViewerLib = typeof import("pdfjs-dist/web/pdf_viewer.mjs");

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

export function loadPdfjs(): Promise<PdfjsLib> {
  return (lib ??= (async () => {
    const pdfjs = await import("pdfjs-dist");
    const worker = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
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
    return import("pdfjs-dist/web/pdf_viewer.mjs");
  })());
}
