// Generate a 3-page PDF test file with pdf-lib.
import { PDFDocument, StandardFonts } from "@cantoo/pdf-lib";
import { writeFileSync } from "node:fs";
const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
for (let i = 1; i <= 3; i++) {
  const p = doc.addPage([595, 842]);
  p.drawText(`Page ${i}: the quick brown fox jumps over the lazy dog.`, { x: 60, y: 760, size: 16, font });
  p.drawText(`Searchable word: marigold${i}`, { x: 60, y: 720, size: 14, font });
}
writeFileSync(new URL("./corpus/sample.pdf", import.meta.url), await doc.save());
console.log("sample.pdf written");
