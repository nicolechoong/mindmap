import { useRef, ReactNode } from 'react';
import { useMindMapStore } from '../../store/store';
import { 
    IconPlus, IconSibling, IconCheck, IconPaperclip, 
    IconMenu, IconChevronRight, IconLink, 
    IconArrowUp, IconArrowDown, IconTrash, 
    IconCalendar, IconCircle, IconExternalLink,
    IconX
} from '../common/SimpleIcon';
import type { SubNode } from '../../types';

const ROOT_PALETTE = [
    '#f3f4f6', // Light Gray (default)
    '#000000', // Black
    '#6c63ff', // Indigo
    '#3b82f6', // Blue
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#f97316', // Orange
    '#ef4444', // Red
    '#ec4899', // Pink
];
// ── Custom colour swatch ──────────────────────────────────────────────────

interface CustomSwatchProps {
    currentColor: string;
    paletteColors: string[];
    onPick: (color: string) => void;
}

function CustomColorSwatch({ currentColor, paletteColors, onPick }: CustomSwatchProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const isCustom = !paletteColors.includes(currentColor);

    return (
        <button
            className={`ctx-swatch ctx-swatch-custom${isCustom ? ' ctx-swatch-active' : ''}`}
            style={isCustom ? { background: currentColor } : undefined}
            title="Custom color…"
            onClick={() => inputRef.current?.click()}
        >
            {isCustom ? (
                <span className="ctx-swatch-check">✓</span>
            ) : (
                <span className="ctx-swatch-custom-icon">🎨</span>
            )}
            <input
                ref={inputRef}
                type="color"
                className="ctx-color-input"
                value={isCustom ? currentColor : '#6c63ff'}
                onChange={(e) => onPick(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
            />
        </button>
    );
}


interface ContextMenuProps {
    x: number;
    y: number;
    nodeId: string;
    subNodeId?: string;
    onClose: () => void;
    onSetTime?: (nodeId: string, subNodeId: string) => void;
}


export function ContextMenu({ x, y, nodeId, subNodeId, onClose, onSetTime }: ContextMenuProps) {
    const nodes = useMindMapStore((s) => s.nodes);
    const rootIds = useMindMapStore((s) => s.rootIds);
    const addChildNode = useMindMapStore((s) => s.addChildNode);
    const addSiblingNode = useMindMapStore((s) => s.addSiblingNode);
    const deleteNode = useMindMapStore((s) => s.deleteNode);
    const addSubNode = useMindMapStore((s) => s.addSubNode);
    const deleteSubNode = useMindMapStore((s) => s.deleteSubNode);
    const promoteSubNode = useMindMapStore((s) => s.promoteSubNode);
    const demoteNode = useMindMapStore((s) => s.demoteNode);
    const addAttachmentSubNode = useMindMapStore((s) => s.addAttachmentSubNode);
    const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);
    const setCollapseSubtree = useMindMapStore((s) => s.setCollapseSubtree);
    const pushUndo = useMindMapStore((s) => s.pushUndo);
    const setSelection = useMindMapStore((s) => s.setSelection);
    const updateNodeStyle = useMindMapStore((s) => s.updateNodeStyle);
    const links = useMindMapStore((s) => s.links);
    const setLinkingSource = useMindMapStore((s) => s.setLinkingSource);
    const deleteLink = useMindMapStore((s) => s.deleteLink);
    const reorderSubNode = useMindMapStore((s) => s.reorderSubNode);
    const updateSubNodeTimes = useMindMapStore((s) => s.updateSubNodeTimes);
    const calendarOpen = useMindMapStore((s) => s.calendarOpen);
    const toggleCalendar = useMindMapStore((s) => s.toggleCalendar);
    const reorderRootNode = useMindMapStore((s) => s.reorderRootNode);

    const node = nodes[nodeId];
    if (!node) return null;

    const isRoot = rootIds.includes(nodeId);
    const canDeleteRoot = isRoot && rootIds.length > 1;
    const rootIdx = isRoot ? rootIds.indexOf(nodeId) : -1;

    // Find links involving this node
    const nodeLinks = Object.values(links).filter(
        (l) => l.sourceId === nodeId || l.targetId === nodeId,
    );

    const findSn = (subs: SubNode[], id: string): SubNode | null => {
        for (const sn of subs) {
            if (sn.id === id) return sn;
            const found = findSn(sn.subNodes, id);
            if (found) return found;
        }
        return null;
    };

    const sn = subNodeId ? findSn(node.subNodes, subNodeId) : null;

    // Find top-level index for reorder
    const topLevelIdx = subNodeId ? node.subNodes.findIndex((s) => s.id === subNodeId) : -1;
    const isTopLevel = topLevelIdx >= 0;

    const items: { label: string; icon?: ReactNode; action: () => void; danger?: boolean; disabled?: boolean }[] = [];

    if (subNodeId && sn) {
        // SubNode context menu
        const isAttachment = sn.type === 'attachment';
        if (!isAttachment && !sn.childNodeId) {
            items.push({
                label: 'Promote to Node',
                icon: <IconArrowUp size={14} />,
                action: () => { pushUndo(); promoteSubNode(nodeId, subNodeId); },
            });
        } else if (!isAttachment && sn.childNodeId) {
            items.push({
                label: 'Demote Back',
                icon: <IconArrowDown size={14} />,
                action: () => { pushUndo(); demoteNode(sn.childNodeId!); },
            });
        }
        if (isTopLevel) {
            items.push({
                label: 'Move Up',
                icon: <IconArrowUp size={14} />,
                action: () => { pushUndo(); reorderSubNode(nodeId, subNodeId, topLevelIdx - 1); },
                disabled: topLevelIdx === 0,
            });
            items.push({
                label: 'Move Down',
                icon: <IconArrowDown size={14} />,
                action: () => { pushUndo(); reorderSubNode(nodeId, subNodeId, topLevelIdx + 1); },
                disabled: topLevelIdx === node.subNodes.length - 1,
            });
        }
        items.push({
            label: 'Delete Item',
            icon: <IconTrash size={14} />,
            action: () => { pushUndo(); deleteSubNode(nodeId, subNodeId); },
            danger: true,
        });
        // Time items for checklist subnodes
        if (!isAttachment) {
            if (sn.startTime || sn.endTime) {
                items.push({
                    label: 'Clear Time',
                    icon: <IconX size={14} />,
                    action: () => { pushUndo(); updateSubNodeTimes(nodeId, subNodeId, null, null, 'date'); },
                });
            }
            items.push({
                label: 'Set Time',
                icon: <IconCalendar size={14} />,
                action: () => { if (onSetTime) onSetTime(nodeId, subNodeId); },
            });
        }
    } else {
        // Node context menu
        items.push({
            label: 'Add Child',
            icon: <IconPlus size={14} />,
            action: () => {
                pushUndo();
                const newId = addChildNode(nodeId);
                if (newId) {
                    setSelection([newId]);
                    window.dispatchEvent(new CustomEvent('mindmap:edit-node', { detail: { nodeId: newId } }));
                }
            },
        });
        if (node.parentId || isRoot) {
            items.push({
                label: 'Add Sibling',
                icon: <IconSibling size={14} />,
                action: () => {
                    pushUndo();
                    const newId = addSiblingNode(nodeId);
                    if (newId) {
                        setSelection([newId]);
                        window.dispatchEvent(new CustomEvent('mindmap:edit-node', { detail: { nodeId: newId } }));
                    }
                },
            });
        }
        items.push({
            label: 'Add Checklist Item',
            icon: <IconCheck size={14} />,
            action: () => {
                pushUndo();
                const newSubId = addSubNode(nodeId);
                window.dispatchEvent(new CustomEvent('mindmap:edit-subnode', { detail: { nodeId, subNodeId: newSubId } }));
            },
        });
        items.push({
            label: 'Add Attachment',
            icon: <IconPaperclip size={14} />,
            action: async () => {
                const result = await window.electronAPI.pickFile();
                if (result) {
                    pushUndo();
                    addAttachmentSubNode(nodeId, result.filePath, result.fileName);
                }
            },
        });
        if (node.subNodes.length > 0) {
            items.push({
                label: node.subNodesCollapsed ? 'Show Items' : 'Hide Items',
                icon: <IconMenu size={14} />,
                action: () => useMindMapStore.getState().toggleSubNodesCollapsed(nodeId),
            });
        }
        if (node.children.length > 0) {
            if (node.collapsed) {
                items.push({
                    label: 'Expand',
                    icon: <IconCircle size={14} />,
                    action: () => toggleCollapse(nodeId),
                });
                items.push({
                    label: 'Expand All',
                    icon: <IconCircle size={14} strokeWidth={3} />,
                    action: () => setCollapseSubtree(nodeId, false),
                });
            } else {
                items.push({
                    label: 'Collapse',
                    icon: <IconCircle size={14} />,
                    action: () => toggleCollapse(nodeId),
                });
                items.push({
                    label: 'Collapse All',
                    icon: <IconCircle size={14} strokeWidth={3} />,
                    action: () => setCollapseSubtree(nodeId, true),
                });
            }
        }
        items.push({
            label: 'Link to…',
            icon: <IconLink size={14} />,
            action: () => { setLinkingSource(nodeId); },
        });
        if (!isRoot) {
            items.push({
                label: 'Convert to Root Node',
                icon: <IconExternalLink size={14} />,
                action: () => {
                    pushUndo();
                    useMindMapStore.getState().convertToRootNode(nodeId);
                },
            });
        }
        // Move nodes up / down in sibling order
        const reorderChildNode = useMindMapStore.getState().reorderChildNode;
        if (isRoot && rootIds.length > 1) {
            items.push({
                label: 'Move Up',
                icon: <IconArrowUp size={14} />,
                action: () => { pushUndo(); reorderRootNode(nodeId, 'up'); },
                disabled: rootIdx === 0,
            });
            items.push({
                label: 'Move Down',
                icon: <IconArrowDown size={14} />,
                action: () => { pushUndo(); reorderRootNode(nodeId, 'down'); },
                disabled: rootIdx === rootIds.length - 1,
            });
        } else if (!isRoot && node.parentId) {
            const parent = nodes[node.parentId];
            if (parent && parent.children.length > 1) {
                const childIdx = parent.children.indexOf(nodeId);
                items.push({
                    label: 'Move Up',
                    icon: <IconArrowUp size={14} />,
                    action: () => { pushUndo(); reorderChildNode(nodeId, 'up'); },
                    disabled: childIdx === 0,
                });
                items.push({
                    label: 'Move Down',
                    icon: <IconArrowDown size={14} />,
                    action: () => { pushUndo(); reorderChildNode(nodeId, 'down'); },
                    disabled: childIdx === parent.children.length - 1,
                });
            }
        }
        // Show unlink items for each existing link
        for (const link of nodeLinks) {
            const otherId = link.sourceId === nodeId ? link.targetId : link.sourceId;
            const otherNode = nodes[otherId];
            const otherName = otherNode ? otherNode.text.slice(0, 20) : otherId;
            items.push({
                label: `Unlink from ${otherName}`,
                icon: <IconX size={14} />,
                action: () => { pushUndo(); deleteLink(link.id); },
                danger: true,
            });
        }
        if (!isRoot || canDeleteRoot) {
            items.push({
                label: 'Delete Node',
                icon: <IconTrash size={14} />,
                action: () => {
                    pushUndo();
                    const parentId = node.parentId;
                    deleteNode(nodeId);
                    if (parentId) setSelection([parentId]);
                },
                danger: true,
            });
        }
        // Calendar
        items.push({
            label: calendarOpen ? 'Hide Calendar' : 'Show Calendar',
            icon: <IconCalendar size={14} />,
            action: () => { toggleCalendar(); },
        });
    }

    return (
        <>
            <div className="ctx-backdrop" onClick={onClose} />
            <div className="ctx-menu" style={{ left: x, top: y }}>
                    {/* Color palette for all nodes */}
                {!subNodeId && (
                    <div className="ctx-palette">
                        {ROOT_PALETTE.map((color) => (
                            <button
                                key={color}
                                className={`ctx-swatch${node.style.fillColor === color ? ' ctx-swatch-active' : ''}`}
                                style={{ background: color }}
                                onClick={() => {
                                    pushUndo();
                                    updateNodeStyle(nodeId, { fillColor: color });
                                }}
                                title={color}
                            >
                                {node.style.fillColor === color && (
                                    <span className="ctx-swatch-check">✓</span>
                                )}
                            </button>
                        ))}
                        {/* Custom color picker */}
                        <CustomColorSwatch
                            currentColor={node.style.fillColor}
                            paletteColors={ROOT_PALETTE}
                            onPick={(color) => { pushUndo(); updateNodeStyle(nodeId, { fillColor: color }); }}
                        />
                    </div>
                )}
                {!subNodeId && <div className="ctx-divider" />}
                {items.map((item, i) => (
                    <button
                        key={i}
                        className={`ctx-item ${item.danger ? 'ctx-danger' : ''}`}
                        disabled={item.disabled}
                        onClick={() => {
                            item.action();
                            onClose();
                        }}
                    >
                        {item.icon && <span className="ctx-item-icon">{item.icon}</span>}
                        <span className="ctx-item-label">{item.label}</span>
                    </button>
                ))}
            </div>
        </>
    );
}
