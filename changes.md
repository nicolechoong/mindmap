# Change Log: Project Mindmap - `moley` Branch

This document tracks all major changes, feature enhancements, and bug fixes introduced in the `moley` branch compared to the original `main` branch.

## 🚀 Summary of Major Enhancements

### 1. Auto-Save & Persistent State Management
- **Persistent Store:** Implemented a robust auto-save mechanism that ensures all mindmap data and user settings are preserved across app restarts.
- **Boot-up Recovery:** The application now automatically restores the last active mindmap and view settings on launch.
- **Settings Management:** Introduced a centralized settings system for granular user control over application behavior.

### 2. UI/UX Modernization
- **Mini-Map Navigation:** Integrated a new floating `MiniMap.tsx` component that provides a scaled-down overview of the entire canvas, facilitating rapid navigation of large mindmaps.
- **Standardized Icon Library:** Developed a comprehensive `SimpleIcon.tsx` component that replaces diverse icon formats with a unified, minimalist SVG icon set.
- **Revamped Canvas:** Significant architectural updates to `Canvas.tsx` to improve performance and support new interactive elements.
- **Floating Toolbar Improvements:** Enhanced the `FloatingBar.tsx` for a cleaner look and better accessibility.
- **New Management Panels:** Added `RootNodesPanel.tsx` for improved management of root-level nodes in complex diagrams.

### 3. Core Engine & Electron Updates
- **Electron Lifecycle:** Updated `main.ts` and `preload.ts` to support secure IPC communication for file operations and state persistence.
- **Layout Algorithms:** Refined the node positioning logic in `layout.ts` to handle complex branching and side-aware node assignments more effectively.
- **Global Styling:** Massive overhaul of `global.css` to implement a modern design system with better dark mode support and micro-animations.

---

## 📊 File Statistics (Summary)

**22 files changed, 3532 insertions(+), 310 deletions(-)**

| File Path | Lines Added | Description |
| :--- | :--- | :--- |
| `src/components/canvas/Canvas.tsx` | +659 | Core canvas rendering & interaction logic |
| `src/style/global.css` | +594 | Global design system & theme updates |
| `src/store/store.ts` | +385 | Persistent state management & storage logic |
| `src/components/common/SimpleIcon.tsx` | +320 | **New** SVG icon library component |
| `src/components/settings/SettingsModal.tsx`| +232 | **New** comprehensive settings interface |
| `src/components/canvas/MiniMap.tsx` | +228 | **New** navigation mini-map |
| `src/main.ts` | +204 | Electron main process & IPC handlers |
| `src/layout/layout.ts` | +135 | Node layout & positioning engine |
| `src/components/toolbar/FloatingBar.tsx` | +111 | Refined toolbar UI |
| `src/components/toolbar/RootNodesPanel.tsx` | +103 | **New** root node manager panel |
| `src/hooks/useKeyboard.ts` | +62 | Enhanced keyboard shortcut handling |
| `src/components/home/FilesHome.tsx` | +78 | Updated homepage for file management |

---

## 📜 Commit History

- `bc9e46a` feat: implement auto-save and settings (merged)
- `95e3351` feat: implement auto-save, settings management, and persistent file state with boot-up recovery
