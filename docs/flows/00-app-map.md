# App map

Two views of the whole product: the things a user works with, and the screens they move between.

## The things in the app

What exists, and how the pieces relate. Every screen and command is about one of these.

```mermaid
flowchart LR
    Workspace["Workspace<br/>a folder, optional"] -->|contains| File
    File["File<br/>docx, xlsx, pptx, pdf, md, csv, text, code"] -->|opens in| Tab
    Tab -->|shown by| Engine["Engine<br/>text, PDF, grid, office"]
    File -->|has| Version["Version<br/>local snapshot"]
    File -->|has| Location["Location<br/>heading, page, cell, slide, line"]
    Location -->|target of| Link
    File -->|contains| Link
    Link -->|indexed as| Backlink
    File -->|has| Tag["Tags and properties"]
    File -->|carries| Annotation["Annotation<br/>comment, highlight, signature"]
    File -->|converted by| Export["Export<br/>to another format"]
    Device["Device"] -->|records| Session["Session<br/>open tabs, positions"]
    Session -->|refers to| Tab
    Inbox["Inbox<br/>quick capture"] -->|holds| File
```

## Screens and how they connect

```mermaid
flowchart TD
    Launch(["Launch app"]) --> Restore{"Previous session?"}
    Restore -->|Yes| Doc
    Restore -->|No| Home
    Home["Home<br/>recent, pinned, new, continue from device"] -->|open or create| Doc["Document tab"]
    Doc -->|"Ctrl/Cmd+K"| Palette["Command palette"]
    Home -->|"Ctrl/Cmd+K"| Palette
    Palette -->|pick a file| Doc
    Palette -->|run a command| Doc
    Palette -->|search everywhere| Results["Search results"]
    Results --> Doc
    Doc --> Left["Left sidebar<br/>files, outline, thumbnails"]
    Doc --> Right["Right panel<br/>format, comments, backlinks, preview"]
    Doc --> ExportSheet["Export"]
    Doc --> History["Version history"]
    Doc --> Present["Presentation mode"]
    Doc --> Focus["Focus mode"]
    Home --> Settings["Settings"]
    Palette --> Settings
    Doc -->|close last tab| Home
```

## The same map on a phone

On a phone-width window the screens are the same but stack as layers. Back always closes the top layer.

```mermaid
flowchart TD
    Home["Home<br/>root screen"] -->|tap a file| Doc["Document<br/>top bar and bottom bar"]
    Doc -->|tab count button| Switcher["Tab switcher sheet"]
    Switcher --> Doc
    Doc -->|search button| Search["Full-screen search and commands"]
    Search --> Doc
    Doc -->|more| Sheet["Bottom sheet<br/>format, comments, backlinks, info"]
    Doc -->|drawer| Drawer["Files, outline or thumbnails"]
    Doc -->|export or share| Share["Export sheet, then system share"]
    Doc -->|back| Home
    Sheet -->|back| Doc
    Drawer -->|back| Doc
```
