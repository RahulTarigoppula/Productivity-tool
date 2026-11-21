# Search, commands and links

## F-18 Find and replace in a file

The same shortcut and the same bar in every format.

```mermaid
flowchart TD
    A(["Ctrl/Cmd+F"]) --> B["Find bar, same place in every format<br/>shows match count"]
    B --> C(["Types"])
    C --> D["Matches highlighted, first one in view"]
    D --> E{"Action"}
    E -->|Enter| F["Next match"]
    E -->|Opens replace| G["Replace one or all<br/>replace all is a single undo step"]
    E -->|Esc| H["Bar closes, cursor returns to where it was"]
```

## F-19 Search across files

Results land on the exact place, not just the file.

```mermaid
flowchart TD
    A(["Palette with the # prefix,<br/>or the search field on Home"]) --> B(["Types a query"])
    B --> C["Results grouped by file, with a snippet per hit<br/>and its location: page, cell, slide, heading or line"]
    C --> D(["Picks a hit"])
    D --> E["File opens at that location, match highlighted"]
    C --> F["Filters: format, folder, tag, date"]
    F --> C
```

## F-20 Command palette

```mermaid
flowchart TD
    A(["Ctrl/Cmd+K"]) --> B["Palette opens in under 50 ms<br/>empty state: open tabs, recent files, suggestions for this format"]
    B --> C(["Types"])
    C --> D{"Prefix?"}
    D -->|none| E["Everything: files, tabs, commands"]
    D -->|">"| F["Commands only"]
    D -->|"@"| G["Headings or symbols in this file"]
    D -->|":"| H["Go to line, page, cell or slide"]
    D -->|"#"| I["Search inside files"]
    D -->|"?"| J["Help and shortcuts"]
    E --> K(["Enter"])
    F --> K
    K --> L{"Command needs more input?"}
    L -->|Yes| M["Next step stays in the palette<br/>for example: Export, then format"]
    L -->|No| N["Runs. Palette closes. Focus returns to the document"]
    M --> N
```

## F-21 Link two documents, follow a link, backlinks

```mermaid
flowchart TD
    A(["Insert link<br/>toolbar, palette or shortcut"]) --> B["File search inside the link box"]
    B --> C(["Picks a file"])
    C --> D{"Link to a place inside it?"}
    D -->|No| E["Link to the file"]
    D -->|Yes| F["Pick a heading, page, range, slide or line<br/>with a preview"]
    E --> G["Stored as a normal hyperlink in the file,<br/>with a relative path"]
    F --> G
    G --> H(["Later: hovers or long-presses the link"])
    H --> I["Peek preview of the target"]
    I --> J(["Clicks"])
    J --> K["Target opens at that place"]
    K --> L["Right panel lists backlinks:<br/>what links here"]
    L --> M{"Target moved or renamed?"}
    M -->|Yes| N["Link flagged as broken, not removed<br/>repair suggested from the file's identifier"]
```

## F-25 Insert content from another file

```mermaid
flowchart TD
    A(["Insert from file"]) --> B["Pick a file"]
    B --> C["Pick the object: chart, range, page or slide<br/>with a preview"]
    C --> D{"Insert how?"}
    D -->|Linked copy| E["Inserted with a source chip<br/>for example: from budget.xlsx, Summary"]
    D -->|Plain copy| F["Inserted with no link"]
    E --> G(["Source changes later"])
    G --> H["Chip shows: Source changed"]
    H --> I(["Clicks Update"])
    I --> J["Refreshed. Never updates silently.<br/>The update is one undo step"]
```
