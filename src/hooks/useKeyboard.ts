import { useEffect, useCallback } from 'react';
import { useMindMapStore } from '../store/store';

export function useKeyboard() {
    const store = useMindMapStore();

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // Don't handle if typing in an input/textarea
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            const ctrl = e.ctrlKey || e.metaKey;
            const shift = e.shiftKey;
            const selected = store.selectedNodeIds;
            const firstSelected = selected.length > 0 ? selected[0] : null;

            // ── File operations ──────────────────────────────────────────────
            if (ctrl && !shift && e.key === 's') {
                e.preventDefault();
                const doc = store.toDocument();
                window.electronAPI?.fileSave(JSON.stringify(doc, null, 2));
                return;
            }
            if (ctrl && shift && e.key === 'S') {
                e.preventDefault();
                const doc = store.toDocument();
                window.electronAPI?.fileSaveAs(JSON.stringify(doc, null, 2));
                return;
            }
            if (ctrl && e.key === 'o') {
                e.preventDefault();
                window.electronAPI?.fileOpen().then((result) => {
                    if (result) {
                        try {
                            const doc = JSON.parse(result.content);
                            store.loadDocument(doc);
                        } catch {
                            console.error('Failed to parse file');
                        }
                    }
                });
                return;
            }

            // ── Undo/Redo ────────────────────────────────────────────────────
            if (ctrl && !shift && e.key === 'z') {
                e.preventDefault();
                store.undo();
                return;
            }
            if (ctrl && (e.key === 'y' || (shift && e.key === 'Z'))) {
                e.preventDefault();
                store.redo();
                return;
            }

            // ── Link operations ──────────────────────────────────────────────
            if (e.key === 'Escape') {
                if (store.linkingSourceId) {
                    store.setLinkingSource(null);
                }
                return;
            }
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (store.selectedLinkId) {
                    e.preventDefault();
                    store.pushUndo();
                    store.deleteLink(store.selectedLinkId);
                    return;
                }
            }

            // ── Node operations (require selection) ──────────────────────────
            if (!firstSelected) return;

            if (e.key === 'Tab') {
                e.preventDefault();
                store.pushUndo();
                const newId = store.addChildNode(firstSelected);
                if (newId) store.setSelection([newId]);
                return;
            }

            if (e.key === 'Enter' && !ctrl) {
                e.preventDefault();
                const node = store.nodes[firstSelected];
                // Works for both root nodes (adds sibling root) and child nodes
                if (node?.parentId || store.rootIds.includes(firstSelected)) {
                    store.pushUndo();
                    const newId = store.addSiblingNode(firstSelected);
                    if (newId) store.setSelection([newId]);
                }
                return;
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                const node = store.nodes[firstSelected];
                const isRoot = store.rootIds.includes(firstSelected);
                // Allow deleting roots if more than one, or non-roots with a parent
                if ((isRoot && store.rootIds.length > 1) || (!isRoot && node?.parentId)) {
                    store.pushUndo();
                    const parentId = node?.parentId;
                    store.deleteNode(firstSelected);
                    if (parentId) store.setSelection([parentId]);
                    else if (store.rootIds.length > 0) {
                        store.setSelection([store.rootIds[0]]);
                    }
                }
                return;
            }

            if (e.key === ' ') {
                e.preventDefault();
                store.toggleCollapse(firstSelected);
                return;
            }

            if (e.key === 'F2') {
                e.preventDefault();
                // Dispatch custom event for inline editing
                window.dispatchEvent(
                    new CustomEvent('mindmap:edit-node', { detail: { nodeId: firstSelected } }),
                );
                return;
            }

            // ── Arrow navigation ─────────────────────────────────────────────
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                const node = store.nodes[firstSelected];
                if (node && node.children.length > 0 && !node.collapsed) {
                    store.setSelection([node.children[0]]);
                }
                return;
            }

            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                const node = store.nodes[firstSelected];
                if (node?.parentId) {
                    store.setSelection([node.parentId]);
                }
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const node = store.nodes[firstSelected];
                if (node?.parentId) {
                    const parent = store.nodes[node.parentId];
                    if (parent) {
                        const idx = parent.children.indexOf(firstSelected);
                        if (idx < parent.children.length - 1) {
                            store.setSelection([parent.children[idx + 1]]);
                        }
                    }
                } else {
                    // Root node: navigate to next root
                    const idx = store.rootIds.indexOf(firstSelected);
                    if (idx < store.rootIds.length - 1) {
                        store.setSelection([store.rootIds[idx + 1]]);
                    }
                }
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const node = store.nodes[firstSelected];
                if (node?.parentId) {
                    const parent = store.nodes[node.parentId];
                    if (parent) {
                        const idx = parent.children.indexOf(firstSelected);
                        if (idx > 0) {
                            store.setSelection([parent.children[idx - 1]]);
                        }
                    }
                } else {
                    // Root node: navigate to previous root
                    const idx = store.rootIds.indexOf(firstSelected);
                    if (idx > 0) {
                        store.setSelection([store.rootIds[idx - 1]]);
                    }
                }
                return;
            }

            // ── Zoom ─────────────────────────────────────────────────────────
            if (ctrl && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                store.zoomViewport(store.viewport.zoom + 0.1);
                return;
            }
            if (ctrl && e.key === '-') {
                e.preventDefault();
                store.zoomViewport(store.viewport.zoom - 0.1);
                return;
            }
            if (ctrl && e.key === '0') {
                e.preventDefault();
                store.setViewport({ x: 0, y: 0, zoom: 1 });
                return;
            }
        },
        [store],
    );

    useEffect(() => {
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleKeyDown]);
}
