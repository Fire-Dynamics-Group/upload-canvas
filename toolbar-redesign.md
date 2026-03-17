# Toolbar Redesign Plan

## Inspiration
- Excalidraw-style grouped tools with number key shortcuts and dropdown sub-menus

## Design Pattern
- Bottom-center floating pill toolbar with icons
- Related tools grouped into single slots with dropdown arrows
- Number keys to select groups, press again to cycle through sub-tools
- Icons with tooltips (name + shortcut) on hover

## Tool Groups

| Key | Group | Sub-tools |
|-----|-------|-----------|
| **1** | Select | Selection |
| **2** | Obstruction | Obstruction / Stair Obstruction |
| **3** | Mesh | Mesh / Stair Mesh / Stair Landing |
| **4** | Fire | Fire / (future fire variants) |
| **5** | Door | Door / (future door variants) |
| **6** | Inputs | Opens inputs panel |
| **7** | Generate | Generate FDS code |

## Notes
- Fire and Door are separate categories — each will have many sub-options over time
- "Change Mode" button removed — the toolbar itself is the mode selector
- Reference apps: Excalidraw, tldraw, Figma, FigJam, Miro
