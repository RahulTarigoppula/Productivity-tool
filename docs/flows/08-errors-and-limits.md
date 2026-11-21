# Errors and limits

The rule for all of these: explain in plain words, and always offer a way forward.

## F-35 File cannot be read

```mermaid
flowchart TD
    A(["Opens a file"]) --> B{"Problem"}
    B -->|Damaged| C["This file is damaged and cannot be opened normally"]
    B -->|Password protected| D["Ask for the password"]
    B -->|Not downloaded yet| E["Downloading from your cloud folder, with progress"]
    B -->|Unknown type| F["Open as text, or as a hex view if binary"]
    C --> G["Ways forward:<br/>Open as text · Open a previous version · Try repair · Show in folder"]
    D --> H["Opens"]
    E --> H
```

## F-36 Unsupported feature or lossy save

```mermaid
flowchart TD
    A(["Opens a file with something<br/>the engine cannot edit"]) --> B["Non-blocking banner listing<br/>what is view-only or may not be preserved"]
    B --> C(["Keeps working"])
    C --> D(["Saves to a format that cannot hold everything<br/>for example a formatted sheet to CSV"])
    D --> E["Says exactly what will be lost"]
    E --> F{"Choice"}
    F -->|Keep original and save a copy| G["Both files exist. Nothing lost"]
    F -->|Save anyway| H["Saved. Previous state kept as a version"]
    F -->|Cancel| I["Back to editing"]
```

## F-37 Missing engine pack, low storage, offline

```mermaid
flowchart TD
    A(["Opens an office file"]) --> B{"Office pack installed?"}
    B -->|Yes| C["Engine loads. Shell stays responsive.<br/>One line says what is loading"]
    B -->|No| D["Shown inline in the tab:<br/>Download the office pack, with its size"]
    D --> E{"Online?"}
    E -->|Yes| F["Download, verify, open"]
    E -->|No| G["View-only preview if possible<br/>and a note that editing needs the pack"]
    C --> H{"File too large for this device?"}
    H -->|Yes| I["Opens read-only with the reason.<br/>Offer: edit on your computer"]
    H -->|No| J(["Editing"])
    J --> K{"Storage nearly full?"}
    K -->|Yes| L["Warn before a save can fail.<br/>Work stays in memory. Offer to free space"]
```

## F-38 Permission prompts on phones

```mermaid
flowchart TD
    A(["Does something that needs access"]) --> B{"Can a system picker do it<br/>without a broad permission?"}
    B -->|Yes| C["Use the system picker. No permission prompt"]
    B -->|No| D["One line explaining why, at the moment of need"]
    D --> E{"Granted?"}
    E -->|Yes| F["Continue"]
    E -->|No| G["Feature explains itself and how to enable it later.<br/>The rest of the app works normally"]
```

## F-41 Switch view on phones

```mermaid
flowchart TD
    A(["Office file open on a phone"]) --> B["Opens in view mode, with one clear Edit button"]
    B --> C(["View toggle in the top bar"])
    C --> D{"Format"}
    D -->|Document| E["Page view or Reflow view"]
    D -->|Spreadsheet| F["Grid or Record cards for any range with a header row"]
    D -->|Slides| G["Filmstrip or single slide"]
    E --> H["Reflow shows: N objects hidden.<br/>Tap to see them in Page view"]
    F --> I["Switching never changes the file"]
    G --> I
    H --> I
```
