# Tabs, saving and history

## F-08 Switch tab and F-09 split view

```mermaid
flowchart TD
    A(["Wants another open file"]) --> B{"Window size"}
    B -->|Large| C["Click a tab, or Ctrl+Tab<br/>in most recently used order"]
    B -->|Compact| D["Tap the tab count button<br/>or swipe the top bar"]
    D --> E["Tab switcher sheet<br/>thumbnails, swipe to close"]
    C --> F["Tab shown in under 50 ms<br/>if it was hibernated, restored with a brief shimmer"]
    E --> F
    F --> G(["Editing"])
    G --> H(["Drags a tab to the window edge"])
    H --> I{"Window size"}
    I -->|Expanded or large| J["Two panes side by side<br/>drag content between them"]
    I -->|Compact| K["Not offered.<br/>Peek a linked file in a sheet instead"]
```

## F-11 Save, auto-save, Save As

The save state is always visible in one place. Quitting never asks about saving.

```mermaid
flowchart TD
    A(["User edits"]) --> B{"Kind of file"}
    B -->|Text, Markdown, code, CSV| C["Written to the file shortly after typing stops<br/>State: Saved"]
    B -->|Office or PDF| D["Recovery snapshot about a second after edits stop<br/>State: Edited"]
    D --> E(["Ctrl/Cmd+S, or the auto-save interval"])
    E --> F["Write safely, then verify the written file opens"]
    F --> G{"Verified?"}
    G -->|Yes| H["State: Saved"]
    G -->|No| I["Original untouched<br/>State: Save failed, with Retry and Save a copy"]
    C --> J(["Save As or Export"])
    H --> J
    J --> K{"New format can hold everything?"}
    K -->|Yes| L["Save. Tab now points at the new file"]
    K -->|No| M["Go to F-36"]
```

## F-12 Version history and restore

```mermaid
flowchart TD
    A(["Clicks the save state,<br/>or runs Version history"]) --> B["Timeline of local snapshots<br/>grouped by day"]
    B --> C(["Selects a version"])
    C --> D["Read-only preview beside the current file<br/>Compare view where the format supports it"]
    D --> E{"Action"}
    E -->|Restore| F["Current state is saved as a new version first<br/>then the old one is restored"]
    E -->|Copy something out| G["Select and copy from the preview"]
    E -->|Open as copy| H["Old version opens as an untitled tab"]
    F --> I["Restore can be undone"]
```

## F-14 File changed outside the app

```mermaid
flowchart TD
    A["File changes on disk<br/>while open here"] --> B{"Unsaved edits here?"}
    B -->|No| C["Reload quietly, keep position"]
    B -->|Yes| D["Banner: Changed outside the app"]
    D --> E{"Choice"}
    E -->|Reload| F["Load theirs. Mine is kept as a version"]
    E -->|Keep mine| G["Keep editing. Theirs is kept as a version"]
    E -->|Compare| H["Compare view, then choose"]
```

## F-39 Recovery after a crash

```mermaid
flowchart TD
    A(["App is killed or crashes"]) --> B(["Next launch"])
    B --> C["Tabs restored silently<br/>each with its unsaved changes"]
    C --> D["Small Recovered note on affected tabs"]
    D --> E{"User's choice per tab"}
    E -->|Keep working| F["Normal save applies"]
    E -->|Discard recovery| G["Revert to the saved file<br/>recovery kept as a version"]
```
