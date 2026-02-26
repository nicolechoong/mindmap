import { useMindMapStore } from '../../store/store';

interface FloatingBarProps {
    zoom: number;
    onToggleTheme: () => void;
    theme: 'dark' | 'light';
}

/**
 * A minimal floating toolbar that sits at the bottom of the canvas.
 */
export function FloatingBar({ zoom, onToggleTheme, theme }: FloatingBarProps) {
    const rootIds = useMindMapStore((s) => s.rootIds);
    const selectedNodeIds = useMindMapStore((s) => s.selectedNodeIds);
    const nodes = useMindMapStore((s) => s.nodes);
    const addChildNode = useMindMapStore((s) => s.addChildNode);
    const addRootNode = useMindMapStore((s) => s.addRootNode);
    const addSiblingNode = useMindMapStore((s) => s.addSiblingNode);
    const deleteNode = useMindMapStore((s) => s.deleteNode);
    const pushUndo = useMindMapStore((s) => s.pushUndo);
    const undo = useMindMapStore((s) => s.undo);
    const redo = useMindMapStore((s) => s.redo);
    const setSelection = useMindMapStore((s) => s.setSelection);
    const zoomViewport = useMindMapStore((s) => s.zoomViewport);
    const setViewport = useMindMapStore((s) => s.setViewport);
    const undoStack = useMindMapStore((s) => s.undoStack);
    const redoStack = useMindMapStore((s) => s.redoStack);

    const firstSelected = selectedNodeIds.length > 0 ? selectedNodeIds[0] : null;
    const isRoot = firstSelected ? rootIds.includes(firstSelected) : false;
    const canDelete = firstSelected && !(isRoot && rootIds.length <= 1);
    const canAddSibling = firstSelected && (nodes[firstSelected]?.parentId || isRoot);

    // Repurposed + button: add child if selected, add root if nothing selected
    const handleAdd = () => {
        pushUndo();
        if (firstSelected) {
            const newId = addChildNode(firstSelected);
            if (newId) setSelection([newId]);
        } else {
            const newId = addRootNode();
            if (newId) setSelection([newId]);
        }
    };

    const handleAddSibling = () => {
        if (!firstSelected || !canAddSibling) return;
        pushUndo();
        const newId = addSiblingNode(firstSelected);
        if (newId) setSelection([newId]);
    };

    const handleDelete = () => {
        if (!canDelete || !firstSelected) return;
        pushUndo();
        const parentId = nodes[firstSelected]?.parentId;
        deleteNode(firstSelected);
        if (parentId) setSelection([parentId]);
    };

    return (
        <div className="floating-bar">
            <div className="fab-group">
                <button
                    className="fab-btn"
                    title="Undo (Ctrl+Z)"
                    onClick={undo}
                    disabled={undoStack.length === 0}
                >
                    ↩
                </button>
                <button
                    className="fab-btn"
                    title="Redo (Ctrl+Y)"
                    onClick={redo}
                    disabled={redoStack.length === 0}
                >
                    ↪
                </button>
            </div>

            <div className="fab-divider" />

            <div className="fab-group">
                <button
                    className="fab-btn"
                    title={firstSelected ? 'Add Child (Tab)' : 'Add Root Node'}
                    onClick={handleAdd}
                >
                    ＋
                </button>
                <button
                    className="fab-btn"
                    title="Add Sibling (Enter)"
                    onClick={handleAddSibling}
                    disabled={!canAddSibling}
                >
                    ↕
                </button>
                <button
                    className="fab-btn"
                    title="Delete (Del)"
                    onClick={handleDelete}
                    disabled={!canDelete}
                >
                    ✕
                </button>
            </div>

            <div className="fab-divider" />

            <div className="fab-group">
                <button className="fab-btn" title="Zoom Out" onClick={() => zoomViewport(zoom - 0.1)}>
                    −
                </button>
                <span className="fab-zoom">{Math.round(zoom * 100)}%</span>
                <button className="fab-btn" title="Zoom In" onClick={() => zoomViewport(zoom + 0.1)}>
                    ＋
                </button>
                <button className="fab-btn" title="Reset View" onClick={() => setViewport({ x: 0, y: 0, zoom: 1 })}>
                    ⊞
                </button>
            </div>
        </div>
    );
}
