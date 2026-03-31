import { useMindMapStore } from '../../store/store';
import { 
    IconUndo, IconRedo, IconPlus, IconSibling, IconX, 
    IconMinus, IconFit, IconTidy, IconCurve, 
    IconCornerDownRight, IconStraight, IconAnchorAdjust,
    IconMenu, IconCalendar 
} from '../common/SimpleIcon';

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
    const fitViewToNodes = useMindMapStore((s) => s.fitViewToNodes);
    const undoStack = useMindMapStore((s) => s.undoStack);
    const redoStack = useMindMapStore((s) => s.redoStack);
    const calendarOpen = useMindMapStore((s) => s.calendarOpen);
    const toggleCalendar = useMindMapStore((s) => s.toggleCalendar);
    const connectorAnchor = useMindMapStore((s) => s.connectorAnchor);
    const lineStyle = useMindMapStore((s) => s.lineStyle);
    const setConnectorAnchor = useMindMapStore((s) => s.setConnectorAnchor);
    const setLineStyle = useMindMapStore((s) => s.setLineStyle);
    const tidyUp = useMindMapStore((s) => s.tidyUp);
    const rootNodesPanelOpen = useMindMapStore((s) => s.rootNodesPanelOpen);
    const toggleRootNodesPanel = useMindMapStore((s) => s.toggleRootNodesPanel);

    const firstSelected = selectedNodeIds.length > 0 ? selectedNodeIds[0] : null;
    const isRoot = firstSelected ? rootIds.includes(firstSelected) : false;
    const canDelete = firstSelected && !(isRoot && rootIds.length <= 1);
    const canAddSibling = firstSelected && (nodes[firstSelected]?.parentId || isRoot);

    const handleAdd = () => {
        pushUndo();
        if (firstSelected) {
            const newId = addChildNode(firstSelected);
            if (newId) {
                setSelection([newId]);
                window.dispatchEvent(new CustomEvent('mindmap:edit-node', { detail: { nodeId: newId } }));
            }
        } else {
            const newId = addRootNode();
            if (newId) {
                setSelection([newId]);
                window.dispatchEvent(new CustomEvent('mindmap:edit-node', { detail: { nodeId: newId } }));
            }
        }
    };

    const handleAddSibling = () => {
        if (!firstSelected || !canAddSibling) return;
        pushUndo();
        const newId = addSiblingNode(firstSelected);
        if (newId) {
            setSelection([newId]);
            window.dispatchEvent(new CustomEvent('mindmap:edit-node', { detail: { nodeId: newId } }));
        }
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
                    <IconUndo size={16} />
                </button>
                <button
                    className="fab-btn"
                    title="Redo (Ctrl+Y)"
                    onClick={redo}
                    disabled={redoStack.length === 0}
                >
                    <IconRedo size={16} />
                </button>
            </div>

            <div className="fab-divider" />

            <div className="fab-group">
                <button
                    className="fab-btn"
                    title={firstSelected ? 'Add Child (Tab)' : 'Add Root Node'}
                    onClick={handleAdd}
                >
                    <IconPlus />
                </button>
                <button
                    className="fab-btn"
                    title="Add Sibling (Enter)"
                    onClick={handleAddSibling}
                    disabled={!canAddSibling}
                >
                    <IconSibling />
                </button>
                <button
                    className="fab-btn"
                    title="Delete (Del)"
                    onClick={handleDelete}
                    disabled={!canDelete}
                >
                    <IconX size={16} />
                </button>
            </div>

            <div className="fab-divider" />

            <div className="fab-group">
                <button className="fab-btn" title="Zoom Out" onClick={() => {
                    const currentPercent = Math.round(zoom * 100);
                    const nextPercent = Math.floor((currentPercent - 1) / 10) * 10;
                    zoomViewport(nextPercent / 100);
                }}>
                    <IconMinus size={16} />
                </button>
                <span className="fab-zoom">{Math.round(zoom * 100)}%</span>
                <button className="fab-btn" title="Zoom In" onClick={() => {
                    const currentPercent = Math.round(zoom * 100);
                    const nextPercent = Math.ceil((currentPercent + 1) / 10) * 10;
                    zoomViewport(nextPercent / 100);
                }}>
                    <IconPlus size={16} />
                </button>
                <button className="fab-btn" title="Fit to Screen" onClick={() => {
                    const stage = document.querySelector('.konvajs-content');
                    if (stage) {
                        fitViewToNodes(stage.clientWidth, stage.clientHeight);
                    } else {
                        fitViewToNodes(window.innerWidth, window.innerHeight);
                    }
                }}>
                    <IconFit size={16} />
                </button>
            </div>

            <div className="fab-divider" />

            <button
                className="fab-btn"
                title="Auto Layout — Reset all nodes into neat level columns"
                onClick={() => {
                    pushUndo();
                    tidyUp();
                }}
            >
                <IconTidy size={16} />
            </button>

            <div className="fab-divider" />

            <div className="fab-group">
                <button
                    className={`fab-btn${lineStyle === 'bezier' ? ' fab-btn-active' : ''}`}
                    title="Curved lines"
                    onClick={() => setLineStyle('bezier')}
                >
                    <IconCurve size={16} />
                </button>
                <button
                    className={`fab-btn${lineStyle === 'orthogonal' ? ' fab-btn-active' : ''}`}
                    title="Right-angle lines"
                    onClick={() => setLineStyle('orthogonal')}
                >
                    <IconCornerDownRight size={16} />
                </button>
                <button
                    className={`fab-btn${lineStyle === 'straight' ? ' fab-btn-active' : ''}`}
                    title="Straight lines"
                    onClick={() => setLineStyle('straight')}
                >
                    <IconStraight size={16} />
                </button>
            </div>

            <div className="fab-group">
                <button
                    className={`fab-btn${connectorAnchor === 'horizontal' ? ' fab-btn-active' : ''}`}
                    title={connectorAnchor === 'horizontal' ? 'Horizontal anchors (left/right only) — click to switch to adaptive' : 'Adaptive anchors — click for horizontal-only'}
                    onClick={() => setConnectorAnchor(connectorAnchor === 'horizontal' ? 'adaptive' : 'horizontal')}
                >
                    <IconAnchorAdjust size={16} />
                </button>
            </div>

            <div className="fab-divider" />

            <div className="fab-group">
                <button
                    className={`fab-btn ${rootNodesPanelOpen ? 'fab-btn-active' : ''}`}
                    title="Toggle Root Nodes Panel"
                    onClick={toggleRootNodesPanel}
                >
                    <IconMenu size={16} />
                </button>
                <button
                    className={`fab-btn ${calendarOpen ? 'fab-btn-active' : ''}`}
                    title="Toggle Calendar (Ctrl+Shift+K)"
                    onClick={toggleCalendar}
                >
                    <IconCalendar size={16} />
                </button>
            </div>
        </div>
    );
}
