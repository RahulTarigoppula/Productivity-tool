"""Build the sample corpus used by the end-to-end tests (docs/plans/04-verification.md).
Run: python tests/make_corpus.py  (needs python-docx, openpyxl, python-pptx)."""
from pathlib import Path
import docx, openpyxl, pptx
from pptx.util import Inches

out = Path(__file__).parent / "corpus"
out.mkdir(exist_ok=True)

(out / "notes.md").write_bytes(
    b"\xef\xbb\xbf# Project notes\r\n\r\nSome **bold** and *italic* text with a [link](plan.md#goals).\r\n\r\n"
    b"## Tasks\r\n\r\n- [ ] Write the plan\r\n- [x] Pick the engines\r\n\r\n## Goals\r\n\r\n> Calm and fast.\r\n\r\n"
    b"```js\r\nconsole.log('hello');\r\n```\r\n"
)
(out / "plan.md").write_text("# Plan\n\n## Goals\n\nShip the Windows app.\n", encoding="utf-8")
(out / "legacy.txt").write_bytes("café “quoted”\r\nsecond line\r\n".encode("cp1252"))
(out / "script.py").write_text("#!/usr/bin/env python3\n\ndef greet(name):\n    return f\"Hello {name}\"\n", encoding="utf-8")
(out / "data.csv").write_bytes(
    b'id,name,zip,amount\r\n00012,"Smith, J",01234,10.5\r\n00013,Lee,98765,20\r\n00014,"Quote ""Q""",00001,30\r\n'
)
(out / "semi.csv").write_bytes(b"a;b;c\n1;2;3\n4;5;6")

d = docx.Document()
d.add_heading("Quarterly report", 1)
d.add_paragraph("This document was generated for testing the Word preview.")
d.add_heading("Findings", 2)
d.add_paragraph("Revenue grew steadily.", style="List Bullet")
d.save(out / "report.docx")

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Budget"
ws.append(["Item", "Cost"])
ws.append(["Rent", 1200])
ws.append(["Food", 450])
ws["A4"] = "Total"
ws["B4"] = "=SUM(B2:B3)"
wb.create_sheet("Notes")["A1"] = "Second sheet"
wb.save(out / "budget.xlsx")

p = pptx.Presentation()
s = p.slides.add_slide(p.slide_layouts[1])
s.shapes.title.text = "Roadmap"
s.placeholders[1].text = "Windows first, then Android"
s.notes_slide.notes_text_frame.text = "Mention the spikes"
s2 = p.slides.add_slide(p.slide_layouts[5])
s2.shapes.title.text = "Thanks"
p.save(out / "deck.pptx")
print("corpus written to", out)
