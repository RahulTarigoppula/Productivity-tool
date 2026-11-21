# Presenting slides

## F-27 Present on one screen

**Step target: 1 action.**

```mermaid
flowchart TD
    A(["F5, the Present button, or the palette"]) --> B["Full screen from the current slide"]
    B --> C{"Input"}
    C -->|Right, Space, click, swipe| D["Next"]
    C -->|Left, swipe back| E["Previous"]
    C -->|Number then Enter| F["Jump to that slide"]
    C -->|Esc or back| G["Exit to the same slide in the editor"]
    D --> C
    E --> C
    F --> C
```

## F-28 Presenter view on two screens

```mermaid
flowchart TD
    A(["Present"]) --> B{"Second display connected?"}
    B -->|No| C["Go to F-27"]
    B -->|Yes| D["Audience display: slides<br/>This display: current slide, next slide, notes, timer"]
    D --> E(["One key swaps the displays"])
    D --> F(["Esc ends on both"])
```

## F-29 Phone as a remote

A later feature; mapped in one line until its phase.

```mermaid
flowchart LR
    A(["Desktop shows a short pairing code"]) --> B(["Phone enters it on the same network"]) --> C["Phone shows notes, next slide and timer<br/>swipe to advance"]
```
