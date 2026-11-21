# Starting and opening

## F-01 First launch

No account, no tour. **Step target: 1 action to a working document.**

```mermaid
flowchart TD
    A(["Launch for the first time"]) --> B["Home with three actions:<br/>Open, New, drop a file here<br/>plus one sample file per format"]
    B --> C{"What does the user do?"}
    C -->|Opens or drops a file| D["File opens in a tab"]
    C -->|Chooses New| E["Go to F-03"]
    C -->|Opens a sample| D
    D --> F["One dismissible hint:<br/>Ctrl/Cmd+K finds everything"]
    F --> G(["Working"])
    C -->|On a phone| H["Ask for file access only when<br/>the user first opens or saves"]
    H --> D
```

## F-02 Home

```mermaid
flowchart TD
    A(["Open Home"]) --> B["Pinned files<br/>Recent files with format icon, location, last edited<br/>Continue from another device<br/>New row, one tile per format"]
    B --> C{"Action"}
    C -->|Type| D["Filter recents and search files"]
    C -->|Tap a file| E["Open at last position"]
    C -->|New tile| F["Go to F-03"]
    C -->|Select several| G["Batch actions:<br/>export, merge PDFs, move"]
    D --> E
```

## F-03 New document

Naming and location are deferred to first save. **Step target: 2 actions.**

```mermaid
flowchart TD
    A(["New"]) --> B["Format chooser, last used first<br/>templates in a second row"]
    B -->|Pick a format| C["Blank untitled tab opens at once<br/>cursor ready"]
    B -->|Pick a template| T["Template opens as untitled copy<br/>variables such as date filled in"]
    C --> D(["User types"])
    T --> D
    D --> E["Work is kept in recovery storage<br/>title shows Untitled, not yet saved"]
    E --> F(["First save"])
    F --> G["Ask name and location once<br/>default: current workspace or last folder"]
    G --> H["Saved. Auto-save from now on"]
```

## F-04 Open with the file picker and F-05 quick open

```mermaid
flowchart TD
    A(["Wants a file"]) --> B{"How?"}
    B -->|"Ctrl/Cmd+O"| C["System file picker"]
    B -->|"Ctrl/Cmd+K, type a name"| D["Palette: open tabs, then recents, then workspace files"]
    B -->|Home list| E["Recent files"]
    C --> F{"Already open?"}
    D --> F
    E --> F
    F -->|Yes| G["Switch to its tab"]
    F -->|No| H{"Engine available?"}
    H -->|Yes| I["Open in a new tab<br/>content appears progressively"]
    H -->|No, pack missing| J["Go to F-37"]
    I --> K{"File readable?"}
    K -->|Yes| L(["Editing, at last position"])
    K -->|No| M["Go to F-35"]
```

## F-07 Open from another app

Covers "Open with" on desktop and share-to-app on phones.

```mermaid
flowchart TD
    A(["Chooses this app for a file<br/>in a file manager, mail or browser"]) --> B["App opens straight into the document<br/>no interstitial screen"]
    B --> C{"Does the app have lasting<br/>access to the original?"}
    C -->|Yes| D["Edits save back to the original"]
    C -->|No, it received a copy| E["Title shows a chip:<br/>Copy, Save to..."]
    E --> F(["User taps Save to"])
    F --> G["Choose a location once<br/>then auto-save as normal"]
```
