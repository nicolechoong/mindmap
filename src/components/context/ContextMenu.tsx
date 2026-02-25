import { useMindMapStore } from '../../store/store';
import type { SubNode } from '../../types';

interface ContextMenuProps {
    x: number;
    y: number;
    nodeId: string;
    subNodeId?: string;
    onClose: () => void;
}

export function ContextMenu({ x, y, nodeId, subNodeId, onClose }: ContextMenuProps) {
    const nodes = useMindMapStore((s) => s.nodes);
    const rootIds = useMindMapStore((s) => s.rootIds);
    const addChildNode = useMindMapStore((s) => s.addChildNode);
    const addRootNode = useMindMapStore((s) => s.addRootNode);
    const addSiblingNode = useMindMapStore((s) => s.addSiblingNode);
    const deleteNode = useMindMapStore((s) => s.deleteNode);
    const addSubNode = useMindMapStore((s) => s.addSubNode);
    const deleteSubNode = useMindMapStore((s) => s.deleteSubNode);
    const promoteSubNode = useMindMapStore((s) => s.promoteSubNode);
    const demoteNode = useMindMapStore((s) => s.demoteNode);
    const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);
    const pushUndo = useMindMapStore((s) => s.pushUndo);
    const setSelection = useMindMapStore((s) => s.setSelection);

    const node = nodes[nodeId];
    if (!node) return null;

    const isRoot = rootIds.includes(nodeId);
    const canDeleteRoot = isRoot && rootIds.length > 1;

    const findSn = (subs: SubNode[], id: string): SubNode | null => {
        for (const sn of subs) {
            if (sn.id === id) return sn;
            const found = findSn(sn.subNodes, id);
            if (found) return found;
        }
        return null;
    };

    const sn = subNodeId ? findSn(node.subNodes, subNodeId) : null;

    const items: { label: string; action: () => void; danger?: boolean; disabled?: boolean }[] = [];

    if (subNodeId && sn) {
        // SubNode context menu
        if (!sn.childNodeId) {
            items.push({
                label: '⤴ Promote to Node',
                action: () => { pushUndo(); promoteSubNode(nodeId, subNodeId); },
            });
        } else {
            items.push({
                label: '⤵ Demote Back',
                action: () => { pushUndo(); demoteNode(sn.childNodeId!); },
            });
        }
        items.push({
            label: '＋ Add Sub-item',
            action: () => { pushUndo(); addSubNode(nodeId, subNodeId); },
        });
        items.push({
            label: '✕ Delete Item',
            action: () => { pushUndo(); deleteSubNode(nodeId, subNodeId); },
            danger: true,
        });
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
        if (node.children.length > 0) {
            items.push({
                label: node.collapsed ? '▸ Expand' : '▾ Collapse',
                action: () => toggleCollapse(nodeId),
            });
        }
        items.push({
            label: '⊕ Add Root Node',
            action: () => {
                pushUndo();
                const newId = addRootNode();
                if (newId) setSelection([newId]);
            },
        });
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
    }

    return (
        <>
            <div className="ctx-backdrop" onClick={onClose} />
            <div className="ctx-menu" style={{ left: x, top: y }}>
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
