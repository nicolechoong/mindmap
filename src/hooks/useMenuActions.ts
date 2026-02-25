import { useEffect } from 'react';
import { useMindMapStore } from '../store/store';
import { toMarkdown, toJson, stageToDataUrl } from '../utils/export';

/**
 * Hook that listens to native menu actions sent from the main process
 * and dispatches them to the store or triggers export operations.
 */
export function useMenuActions(
    stageRef: React.RefObject<{ toDataURL: (config: { pixelRatio: number; mimeType: string }) => string } | null>,
    onToggleTheme: () => void,
    onShowShortcuts: () => void,
) {
    const store = useMindMapStore();

    useEffect(() => {
        if (!window.electronAPI?.onMenuAction) return;

        const unsubscribe = window.electronAPI.onMenuAction(async (action) => {
            switch (action) {
                case 'new':
                    store.newDocument();
                    break;
                case 'open': {
                    const result = await window.electronAPI.fileOpen();
                    if (result) {
                        try {
                            const doc = JSON.parse(result.content);
                            store.loadDocument(doc);
                        } catch {
                            console.error('Failed to parse file');
                        }
                    }
                    break;
                }
                case 'save': {
                    const doc = store.toDocument();
                    await window.electronAPI.fileSave(JSON.stringify(doc, null, 2));
                    break;
                }
                case 'saveAs': {
                    const doc = store.toDocument();
                    await window.electronAPI.fileSaveAs(JSON.stringify(doc, null, 2));
                    break;
                }
                case 'exportPng': {
                    if (stageRef.current) {
                        const dataUrl = stageToDataUrl(stageRef.current);
                        await window.electronAPI.exportPng(dataUrl);
                    }
                    break;
                }
                case 'exportMarkdown': {
                    const doc = store.toDocument();
                    const md = toMarkdown(doc);
                    await window.electronAPI.exportMarkdown(md);
                    break;
                }
                case 'exportJson': {
                    const doc = store.toDocument();
                    const json = toJson(doc);
                    await window.electronAPI.exportJson(json);
                    break;
                }
                case 'undo':
                    store.undo();
                    break;
                case 'redo':
                    store.redo();
                    break;
                case 'tidyUp':
                    store.pushUndo();
                    store.tidyUp();
                    break;
                case 'zoomIn':
                    store.zoomViewport(store.viewport.zoom + 0.15);
                    break;
                case 'zoomOut':
                    store.zoomViewport(store.viewport.zoom - 0.15);
                    break;
                case 'zoomReset':
                    store.setViewport({ x: 0, y: 0, zoom: 1 });
                    break;
                case 'toggleTheme':
                    onToggleTheme();
                    break;
                case 'showShortcuts':
                    onShowShortcuts();
                    break;
                default:
                    break;
            }
        });

        return unsubscribe;
    }, [store, stageRef, onToggleTheme, onShowShortcuts]);
}
