import { useMindMapStore } from '../../store/store';
import type { SubNode } from '../../types';

const ROOT_PALETTE = [
    '#6c63ff', // Indigo (default)
    '#3b82f6', // Blue
    '#06b6d4', // Cyan
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#f97316', // Orange
    '#ef4444', // Red
    '#ec4899', // Pink
];

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

    const node = nodes[nodeId];
    if (!node) return null;

    const isRoot = rootIds.includes(nodeId);
    const canDeleteRoot = isRoot && rootIds.length > 1;

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

    const items: { label: string; action: () => void; danger?: boolean; disabled?: boolean }[] = [];

    if (subNodeId && sn) {
        // SubNode context menu
        const isAttachment = sn.type === 'attachment';
        if (!isAttachment && !sn.childNodeId) {
            items.push({
                label: '⤴ Promote to Node',
                action: () => { pushUndo(); promoteSubNode(nodeId, subNodeId); },
            });
        } else if (!isAttachment && sn.childNodeId) {
            items.push({
                label: '⤵ Demote Back',
                action: () => { pushUndo(); demoteNode(sn.childNodeId!); },
            });
        }
        if (isTopLevel) {
            items.push({
                label: '▲ Move Up',
                action: () => { pushUndo(); reorderSubNode(nodeId, subNodeId, topLevelIdx - 1); },
                disabled: topLevelIdx === 0,
            });
            items.push({
                label: '▼ Move Down',
                action: () => { pushUndo(); reorderSubNode(nodeId, subNodeId, topLevelIdx + 1); },
                disabled: topLevelIdx === node.subNodes.length - 1,
            });
        }
        items.push({
            label: '✕ Delete Item',
            action: () => { pushUndo(); deleteSubNode(nodeId, subNodeId); },
            danger: true,
        });
        // Time items for checklist subnodes
        if (!isAttachment) {
            if (sn.startTime || sn.endTime) {
                items.push({
                    label: '✕ Clear Time',
                    action: () => { pushUndo(); updateSubNodeTimes(nodeId, subNodeId, null, null, 'date'); },
                });
            }
            items.push({
                label: '🕐 Set Time',
                action: () => { if (onSetTime) onSetTime(nodeId, subNodeId); },
            });
        }
    } else {
        // Node context menu
        items.push({
            label: '＋ Add Child',
            action: () => {
                pushUndo();
                const newId = addChildNode(nodeId);
                if (newId) setSelection([newId]);
            },
        });
        if (node.parentId || isRoot) {
            items.push({
                label: '↕ Add Sibling',
                action: () => {
                    pushUndo();
                    const newId = addSiblingNode(nodeId);
                    if (newId) setSelection([newId]);
                },
            });
        }
        items.push({
            label: '☑ Add Checklist Item',
            action: () => { pushUndo(); addSubNode(nodeId); },
        });
        items.push({
            label: '📎 Add Attachment',
            action: async () => {
                const result = await window.electronAPI.pickFile();
                if (result) {
                    pushUndo();
                    addAttachmentSubNode(nodeId, result.filePath, result.fileName);
                }
            },
        });
        if (node.children.length > 0) {
            items.push({
                label: node.collapsed ? '▸ Expand' : '▾ Collapse',
                action: () => toggleCollapse(nodeId),
            });
        }
        items.push({
            label: '🔗 Link to…',
            action: () => { setLinkingSource(nodeId); },
        });
        // Show unlink items for each existing link
        for (const link of nodeLinks) {
            const otherId = link.sourceId === nodeId ? link.targetId : link.sourceId;
            const otherNode = nodes[otherId];
            const otherName = otherNode ? otherNode.text.slice(0, 20) : otherId;
            items.push({
                label: `✕ Unlink from ${otherName}`,
                action: () => { pushUndo(); deleteLink(link.id); },
                danger: true,
            });
        }
        if (!isRoot || canDeleteRoot) {
            items.push({
                label: '✕ Delete Node',
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
            label: calendarOpen ? '📅 Hide Calendar' : '📅 Show Calendar',
            action: () => { toggleCalendar(); },
        });
    }

    return (
        <>
            <div className="ctx-backdrop" onClick={onClose} />
            <div className="ctx-menu" style={{ left: x, top: y }}>
                {/* Color palette for root nodes */}
                {isRoot && !subNodeId && (
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
                    </div>
                )}
                {isRoot && !subNodeId && <div className="ctx-divider" />}
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
                        {item.label}
                    </button>
                ))}
            </div>
        </>
    );
}
