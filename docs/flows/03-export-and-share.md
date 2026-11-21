# Export, share and print

## F-15 Export one file

One verb, one sheet, the same in every format. **Step target: 3 actions for a repeat export** (open the sheet, confirm the remembered format, done).

```mermaid
flowchart TD
    A(["Export<br/>toolbar, palette, menu, or share sheet"]) --> B["Export sheet<br/>target formats with a quality label:<br/>Exact, Good, Text and structure only<br/>last choice preselected"]
    B --> C(["Picks a format"])
    C --> D{"Converter available on this device?"}
    D -->|Yes| E{"Changes layout or loses content?"}
    D -->|Needs a pack| P["Offer download with size"]
    D -->|Desktop only| Q["Say so. Offer: queue for my computer"]
    P --> E
    E -->|No| F["Convert in the background<br/>progress and cancel"]
    E -->|Yes| G["Preview and one line on what is lost"]
    G --> H(["Confirms"])
    H --> F
    F --> I{"Output valid?"}
    I -->|Yes| J["Saved beside the original<br/>Show in folder, Open, Share"]
    I -->|No| K["Nothing written. Explain, offer another route"]
    J --> L["Original is never modified"]
```

## F-16 Batch export

```mermaid
flowchart TD
    A(["Selects several files on Home or in a folder"]) --> B(["Export"])
    B --> C["One target format for all<br/>worst-case quality label shown"]
    C --> D["Progress list, one line per file"]
    D --> E["Result per file: done, done with warnings, failed<br/>Show in folder"]
```

## F-17 Share

```mermaid
flowchart TD
    A(["Share"]) --> B{"Device"}
    B -->|Phone or tablet| C["Share as: original, PDF, or another format"]
    C --> D["Convert if needed, then system share sheet"]
    B -->|Desktop| E["Copy file, copy path, copy link to this location,<br/>reveal in folder, show QR for another device"]
```

## F-30 Print

```mermaid
flowchart TD
    A(["Print"]) --> B["Print and Export to PDF sit together"]
    B --> C{"Format"}
    C -->|Spreadsheet| D["Page preview first:<br/>scaling and page breaks decide the result"]
    C -->|Other| E["System print dialog"]
    D --> E
```
