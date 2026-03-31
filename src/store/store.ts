import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
    MindMapNode,
    MindMapEdge,
    MindMapLink,
    SubNode,
    NodeStyle,
    EdgeStyle,
    ThemeConfig,
    ViewportState,
    MindMapDocument,
    ConnectorStyle,
    ConnectorAnchor,
    LineStyle,
    AppSettings,
} from '../types';
import { computeLayout } from '../layout/layout';

// ── Default styles ────────────────────────────────────────────────────────

const DEFAULT_NODE_STYLE: NodeStyle = {
    fillColor: '#f3f4f6',
    strokeColor: '#6c63ff',
    textColor: '#1a1a2e',
    fontSize: 14,
    fontWeight: 'normal',
    shape: 'rounded',
};

const ROOT_NODE_STYLE: NodeStyle = {
    fillColor: '#f3f4f6',
    strokeColor: '#7f78ff',
    textColor: '#1a1a2e',
    fontSize: 18,
    fontWeight: 'bold',
    shape: 'rounded',
};

const DEFAULT_EDGE_STYLE: EdgeStyle = {
    color: '#6c63ff',
    width: 2,
    curve: 'bezier',
};

// ── Helpers ───────────────────────────────────────────────────────────────

function createNode(
    text: string,
    parentId: string | null,
    parentSubNodeId: string | null = null,
    style: NodeStyle = DEFAULT_NODE_STYLE,
): MindMapNode {
    return {
        id: nanoid(),
        parentId,
        parentSubNodeId,
        children: [],
        text,
        notes: '',
        collapsed: false,
        subNodes: [],
        style,
        position: { x: 0, y: 0 },
    };
}

function createEdge(sourceId: string, targetId: string): MindMapEdge {
    return {
        id: nanoid(),
        sourceId,
        targetId,
        style: { ...DEFAULT_EDGE_STYLE },
    };
}

function createSubNode(
    text: string,
    type: 'checklist' | 'attachment' = 'checklist',
    filePath?: string,
): SubNode {
    return {
        id: nanoid(),
        text,
        type,
        filePath,
        checked: false,
        collapsed: false,
        subNodes: [],
        childNodeId: null,
    };
}

/** Recursively find a SubNode by ID within a nested subnode tree. */
function findSubNode(
    subNodes: SubNode[],
    subNodeId: string,
): SubNode | null {
    for (const sn of subNodes) {
        if (sn.id === subNodeId) return sn;
        const found = findSubNode(sn.subNodes, subNodeId);
        if (found) return found;
    }
    return null;
}

/** Remove a SubNode by ID from a nested tree, returning it. */
function removeSubNode(
    subNodes: SubNode[],
    subNodeId: string,
): SubNode | null {
    for (let i = 0; i < subNodes.length; i++) {
        if (subNodes[i].id === subNodeId) {
            return subNodes.splice(i, 1)[0];
        }
        const found = removeSubNode(subNodes[i].subNodes, subNodeId);
        if (found) return found;
    }
    return null;
}

/** Check if nodeId is a descendant of ancestorId. */
function isDescendant(
    nodes: Record<string, MindMapNode>,
    nodeId: string,
    ancestorId: string,
): boolean {
    let current = nodes[nodeId];
    while (current) {
        if (current.id === ancestorId) return true;
        if (!current.parentId) return false;
        current = nodes[current.parentId];
    }
    return false;
}

/** Collect all node IDs in the subtree rooted at nodeId (including nodeId). */
function collectSubtreeIds(
    nodes: Record<string, MindMapNode>,
    nodeId: string,
): string[] {
    const result: string[] = [nodeId];
    const node = nodes[nodeId];
    if (node) {
        for (const childId of node.children) {
            result.push(...collectSubtreeIds(nodes, childId));
        }
    }
    // Also collect nodes spawned from subnodes
    if (node) {
        const collectFromSubNodes = (sns: SubNode[]) => {
            for (const sn of sns) {
                if (sn.childNodeId && nodes[sn.childNodeId]) {
                    result.push(...collectSubtreeIds(nodes, sn.childNodeId));
                }
                collectFromSubNodes(sn.subNodes);
            }
        };
        collectFromSubNodes(node.subNodes);
    }
    return result;
}

// ── Store types ───────────────────────────────────────────────────────────

export interface MindMapStore {
    // State
    nodes: Record<string, MindMapNode>;
    edges: Record<string, MindMapEdge>;
    links: Record<string, MindMapLink>;
    rootIds: string[];
    manualPositions: Record<string, { x: number; y: number }>;
    selectedNodeIds: string[];
    linkingSourceId: string | null;
    selectedLinkId: string | null;
    viewport: ViewportState;
    title: string;
    isDirty: boolean;

    // Panels
    rootNodesPanelOpen: boolean;
    toggleRootNodesPanel: () => void;
    hiddenRootIds: string[];
    toggleRootVisibility: (nodeId: string) => void;

    // Calendar
    calendarOpen: boolean;
    calendarSplit: 'vertical' | 'horizontal';

    // Connector Style
    connectorStyle: ConnectorStyle;
    connectorAnchor: ConnectorAnchor;
    lineStyle: LineStyle;
    setConnectorStyle: (style: ConnectorStyle) => void;
    setConnectorAnchor: (anchor: ConnectorAnchor) => void;
    setLineStyle: (style: LineStyle) => void;

    // App Settings
    appSettings: AppSettings;
    setAppSettings: (patch: Partial<AppSettings>) => void;

    // History
    undoStack: string[];
    redoStack: string[];

    // Node actions
    addRootNode: (text?: string) => string;
    addChildNode: (parentId: string, text?: string) => string;
    addSiblingNode: (siblingId: string, text?: string) => string;
    deleteNode: (nodeId: string) => void;
    updateNodeText: (nodeId: string, text: string) => void;
    updateNodeNotes: (nodeId: string, notes: string) => void;
    updateNodeStyle: (nodeId: string, style: Partial<NodeStyle>) => void;
    toggleCollapse: (nodeId: string) => void;
    setCollapseSubtree: (nodeId: string, collapsed: boolean) => void;
    toggleSubNodesCollapsed: (nodeId: string) => void;
    convertToRootNode: (nodeId: string) => void;
    reparentNode: (nodeId: string, newParentId: string) => void;
    setNodePosition: (nodeId: string, x: number, y: number) => void;
    tidyUp: () => void;
    expandAllNodes: () => void;
    collapseAllNodes: () => void;
    setNodeSide: (nodeId: string, side: 'left' | 'right') => void;
    reorderRootNode: (nodeId: string, direction: 'up' | 'down') => void;
    reorderChildNode: (nodeId: string, direction: 'up' | 'down') => void;
    moveRootToIndex: (nodeId: string, newIndex: number) => void;
    moveChildToIndex: (nodeId: string, newIndex: number) => void;

    // SubNode actions
    addSubNode: (nodeId: string, parentSubNodeId?: string, text?: string) => string;
    addAttachmentSubNode: (nodeId: string, filePath: string, fileName: string) => void;
    deleteSubNode: (nodeId: string, subNodeId: string) => void;
    updateSubNodeText: (nodeId: string, subNodeId: string, text: string) => void;
    toggleSubNodeChecked: (nodeId: string, subNodeId: string) => void;
    toggleSubNodeCollapse: (nodeId: string, subNodeId: string) => void;
    promoteSubNode: (nodeId: string, subNodeId: string) => string | null;
    demoteNode: (spawnedNodeId: string) => void;
    reorderSubNode: (nodeId: string, subNodeId: string, newIndex: number) => void;
    updateSubNodeTimes: (nodeId: string, subNodeId: string, startTime: string | null, endTime: string | null, granularity: 'date' | 'datetime') => void;

    // Links
    addLink: (sourceId: string, targetId: string) => string;
    deleteLink: (linkId: string) => void;
    setLinkingSource: (nodeId: string | null) => void;
    selectLink: (linkId: string | null) => void;

    // SubNode selection
    selectedSubNodeId: string | null;
    selectedSubNodeParentId: string | null;
    setSelectedSubNode: (nodeId: string | null, subNodeId: string | null) => void;

    // Selection
    setSelection: (nodeIds: string[]) => void;
    toggleSelection: (nodeId: string) => void;
    clearSelection: () => void;

    // Viewport
    panViewport: (dx: number, dy: number) => void;
    zoomViewport: (zoom: number, centerX?: number, centerY?: number) => void;
    setViewport: (viewport: ViewportState) => void;
    fitViewToNodes: (stageWidth: number, stageHeight: number) => void;

    // Calendar
    toggleCalendar: () => void;
    setCalendarSplit: (split: 'vertical' | 'horizontal') => void;

    // Document
    setTitle: (title: string) => void;
    loadDocument: (doc: MindMapDocument) => void;
    toDocument: () => MindMapDocument;
    newDocument: () => void;

    // History
    pushUndo: () => void;
    undo: () => void;
    redo: () => void;
    setDirty: (dirty: boolean) => void;
}

// ── Initial state ─────────────────────────────────────────────────────────

function createInitialState() {
    const rootNode = createNode('Central Idea', null, null, ROOT_NODE_STYLE);
    return {
        nodes: { [rootNode.id]: rootNode },
        edges: {} as Record<string, MindMapEdge>,
        links: {} as Record<string, MindMapLink>,
        rootIds: [rootNode.id],
        manualPositions: {} as Record<string, { x: number; y: number }>,
        selectedNodeIds: [] as string[],
        selectedSubNodeId: null as string | null,
        selectedSubNodeParentId: null,
        linkingSourceId: null,
        selectedLinkId: null,
        viewport: { x: 0, y: 0, zoom: 1 },
        title: 'Untitled',
        isDirty: false,
        hiddenRootIds: [] as string[],
        rootNodesPanelOpen: false,
        calendarOpen: false,
        calendarSplit: 'vertical' as 'vertical' | 'horizontal',
        connectorStyle: 'orthogonal' as ConnectorStyle,
        connectorAnchor: 'adaptive' as ConnectorAnchor,
        lineStyle: 'orthogonal' as LineStyle,
        undoStack: [] as string[],
        redoStack: [] as string[],
        appSettings: {
            libraryPath: '',
            defaultConnectorStyle: 'orthogonal',
            autoSaveInterval: 60,
            theme: 'light',
            inheritParentColor: false,
        } as AppSettings,
    };
}

// ── Store ─────────────────────────────────────────────────────────────────

export const useMindMapStore = create<MindMapStore>()(
    immer((set, get) => ({
        ...createInitialState(),

        // ── Node Actions ────────────────────────────────────────────────────

        addRootNode: (text = 'New Root') => {
            let newNodeId = '';
            set((state) => {
                const rootNode = createNode(text, null, null, ROOT_NODE_STYLE);
                newNodeId = rootNode.id;
                state.nodes[rootNode.id] = rootNode;
                state.rootIds.push(rootNode.id);
                state.isDirty = true;
            });
            return newNodeId;
        },

        addChildNode: (parentId, text = 'New Idea') => {
            let newNodeId = '';
            set((state) => {
                const parent = state.nodes[parentId];
                if (!parent) return;

                // If inherit color is on, copy the parent's fill color to the child
                const childStyle = state.appSettings.inheritParentColor
                    ? { ...DEFAULT_NODE_STYLE, fillColor: parent.style.fillColor }
                    : DEFAULT_NODE_STYLE;

                const child = createNode(text, parentId, null, childStyle);
                newNodeId = child.id;
                
                // Inherit side from parent's branch if parent is not root
                if (parent.parentId) {
                    child.side = parent.side || 'right';
                } else {
                    // Default to right for children of root
                    child.side = 'right';
                }
                
                state.nodes[child.id] = child;
                parent.children.push(child.id);

                const edge = createEdge(parentId, child.id);
                state.edges[edge.id] = edge;

                // Expand parent if collapsed
                if (parent.collapsed) parent.collapsed = false;
                state.isDirty = true;
            });
            return newNodeId;
        },

        addSiblingNode: (siblingId, text = 'New Idea') => {
            let newNodeId = '';
            set((state) => {
                const sibling = state.nodes[siblingId];
                if (!sibling) return;

                // If the sibling is a root node, add a new root after it
                if (!sibling.parentId) {
                    const newRoot = createNode(text, null, null, ROOT_NODE_STYLE);
                    newNodeId = newRoot.id;
                    state.nodes[newRoot.id] = newRoot;
                    const idx = state.rootIds.indexOf(siblingId);
                    state.rootIds.splice(idx + 1, 0, newRoot.id);
                    state.isDirty = true;
                    return;
                }

                const parent = state.nodes[sibling.parentId];
                if (!parent) return;

                // If inherit color is on, copy the parent's fill color to the new sibling
                const siblingStyle = state.appSettings.inheritParentColor
                    ? { ...DEFAULT_NODE_STYLE, fillColor: parent.style.fillColor }
                    : DEFAULT_NODE_STYLE;

                const newNode = createNode(text, parent.id, null, siblingStyle);
                newNodeId = newNode.id;
                
                // Inherit side from sibling
                newNode.side = sibling.side || 'right';
                
                state.nodes[newNode.id] = newNode;

                // Insert after sibling
                const index = parent.children.indexOf(siblingId);
                parent.children.splice(index + 1, 0, newNode.id);

                const edge = createEdge(parent.id, newNode.id);
                state.edges[edge.id] = edge;
                state.isDirty = true;
            });
            return newNodeId;
        },

        deleteNode: (nodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;

                const isRoot = state.rootIds.includes(nodeId);

                // Can't delete the last remaining root
                if (isRoot && state.rootIds.length <= 1) return;

                // Collect all IDs in subtree
                const subtreeIds = collectSubtreeIds(state.nodes, nodeId);

                if (isRoot) {
                    // Remove from rootIds
                    state.rootIds = state.rootIds.filter((id) => id !== nodeId);
                } else if (node.parentId) {
                    // Remove from parent's children
                    const parent = state.nodes[node.parentId];
                    if (parent) {
                        parent.children = parent.children.filter((id) => id !== nodeId);
                    }
                }

                // If spawned from a SubNode, clear the link
                if (node.parentSubNodeId && node.parentId) {
                    const ownerNode = state.nodes[node.parentId];
                    if (ownerNode) {
                        const subNode = findSubNode(ownerNode.subNodes, node.parentSubNodeId);
                        if (subNode) {
                            subNode.childNodeId = null;
                        }
                    }
                }

                // Remove all nodes, edges, and links
                for (const id of subtreeIds) {
                    delete state.nodes[id];
                }
                for (const edgeId of Object.keys(state.edges)) {
                    const edge = state.edges[edgeId];
                    if (subtreeIds.includes(edge.sourceId) || subtreeIds.includes(edge.targetId)) {
                        delete state.edges[edgeId];
                    }
                }
                for (const linkId of Object.keys(state.links)) {
                    const link = state.links[linkId];
                    if (subtreeIds.includes(link.sourceId) || subtreeIds.includes(link.targetId)) {
                        delete state.links[linkId];
                    }
                }

                // Clean selection
                state.selectedNodeIds = state.selectedNodeIds.filter(
                    (id) => !subtreeIds.includes(id),
                );
                if (state.selectedLinkId && !state.links[state.selectedLinkId]) {
                    state.selectedLinkId = null;
                }
                state.isDirty = true;
            });
        },

        updateNodeText: (nodeId, text) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;
                node.text = text;

                // Sync text to linked SubNode if this node was spawned from one
                if (node.parentSubNodeId && node.parentId) {
                    const owner = state.nodes[node.parentId];
                    if (owner) {
                        const subNode = findSubNode(owner.subNodes, node.parentSubNodeId);
                        if (subNode) subNode.text = text;
                    }
                }
                state.isDirty = true;
            });
        },

        updateNodeNotes: (nodeId, notes) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (node) node.notes = notes;
                state.isDirty = true;
            });
        },

        updateNodeStyle: (nodeId, style) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (node) {
                    node.style = { ...node.style, ...style };
                }
                state.isDirty = true;
            });
        },

        toggleCollapse: (nodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (node) node.collapsed = !node.collapsed;
                state.isDirty = true;
            });
        },

        setCollapseSubtree: (nodeId, collapsed) => {
            set((state) => {
                const setAll = (id: string) => {
                    const n = state.nodes[id];
                    if (!n) return;
                    if (n.children.length > 0) n.collapsed = collapsed;
                    for (const childId of n.children) setAll(childId);
                };
                setAll(nodeId);
                state.isDirty = true;
            });
        },

        toggleSubNodesCollapsed: (nodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (node) node.subNodesCollapsed = !node.subNodesCollapsed;
                state.isDirty = true;
            });
        },

        convertToRootNode: (nodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node || !node.parentId) return;

                const parent = state.nodes[node.parentId];
                if (parent) {
                    parent.children = parent.children.filter((id) => id !== nodeId);
                }

                if (node.parentSubNodeId && node.parentId) {
                    const ownerNode = state.nodes[node.parentId];
                    if (ownerNode) {
                        const subNode = findSubNode(ownerNode.subNodes, node.parentSubNodeId);
                        if (subNode) {
                            subNode.childNodeId = null;
                        }
                    }
                }

                for (const edgeId of Object.keys(state.edges)) {
                    if (state.edges[edgeId].targetId === nodeId) {
                        delete state.edges[edgeId];
                        break;
                    }
                }

                node.parentId = null;
                node.parentSubNodeId = null;
                if (typeof ROOT_NODE_STYLE !== 'undefined') {
                    node.style = { ...ROOT_NODE_STYLE, fillColor: node.style.fillColor };
                }
                
                state.rootIds.push(nodeId);
                state.isDirty = true;
            });
        },

        reparentNode: (nodeId, newParentId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                const newParent = state.nodes[newParentId];
                if (!node || !newParent || nodeId === newParentId) return;
                if (isDescendant(state.nodes, newParentId, nodeId)) return; // Prevent cycle

                const isRoot = state.rootIds.includes(nodeId);

                // Remove from old location
                if (isRoot) {
                    // Remove from rootIds (it's becoming a child)
                    state.rootIds = state.rootIds.filter((id) => id !== nodeId);
                } else if (node.parentId) {
                    const oldParent = state.nodes[node.parentId];
                    if (oldParent) {
                        oldParent.children = oldParent.children.filter((id) => id !== nodeId);
                    }
                }

                // Remove old edge
                for (const edgeId of Object.keys(state.edges)) {
                    if (state.edges[edgeId].targetId === nodeId) {
                        delete state.edges[edgeId];
                        break;
                    }
                }

                // Add to new parent
                node.parentId = newParentId;
                node.parentSubNodeId = null;
                newParent.children.push(nodeId);

                // Create new edge
                const edge = createEdge(newParentId, nodeId);
                state.edges[edge.id] = edge;

                // Expand if collapsed
                if (newParent.collapsed) newParent.collapsed = false;
                state.isDirty = true;
            });
        },

        setNodePosition: (nodeId, x, y) => {
            set((state) => {
                state.manualPositions[nodeId] = { x, y };
                state.isDirty = true;
            });
        },

        tidyUp: () => {
            set((state) => {
                state.manualPositions = {};
                state.isDirty = true;
            });
        },

        expandAllNodes: () => {
            set((state) => {
                for (const node of Object.values(state.nodes)) {
                    node.collapsed = false;

                    const expandSubNodes = (sns: SubNode[]) => {
                        for (const sn of sns) {
                            if (sn.childNodeId) {
                                sn.collapsed = false;
                            }
                            if (sn.subNodes.length > 0) {
                                expandSubNodes(sn.subNodes);
                            }
                        }
                    };
                    expandSubNodes(node.subNodes);
                }
                state.isDirty = true;
            });
        },

        collapseAllNodes: () => {
            set((state) => {
                for (const node of Object.values(state.nodes)) {
                    if (node.children.length > 0) node.collapsed = true;
                    if (node.subNodes.length > 0) node.subNodesCollapsed = true;
                }
                state.isDirty = true;
            });
        },

        setNodeSide: (nodeId, side) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;
                node.side = side;
                state.isDirty = true;
            });
        },

        reorderRootNode: (nodeId, direction) => {
            set((state) => {
                const idx = state.rootIds.indexOf(nodeId);
                if (idx < 0) return;
                const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (swapIdx < 0 || swapIdx >= state.rootIds.length) return;
                // Swap entries
                [state.rootIds[idx], state.rootIds[swapIdx]] = [state.rootIds[swapIdx], state.rootIds[idx]];
                state.isDirty = true;
            });
        },

        reorderChildNode: (nodeId, direction) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node || !node.parentId) return;
                const parent = state.nodes[node.parentId];
                if (!parent) return;

                const children = parent.children;
                const idx = children.indexOf(nodeId);
                if (idx < 0) return;

                // Only consider siblings on the same side for children of roots
                const side = node.side || 'right';
                const sameSideIndices = children
                    .map((id, i) => ({ id, i }))
                    .filter(({ id }) => (state.nodes[id]?.side || 'right') === side)
                    .map(({ i }) => i);

                const currentIdxInSide = sameSideIndices.indexOf(idx);
                if (currentIdxInSide < 0) return;

                const targetIdxInSide = direction === 'up' ? currentIdxInSide - 1 : currentIdxInSide + 1;
                if (targetIdxInSide < 0 || targetIdxInSide >= sameSideIndices.length) return;

                const swapIdx = sameSideIndices[targetIdxInSide];
                
                // Swap entries in the main array
                const temp = children[idx];
                children[idx] = children[swapIdx];
                children[swapIdx] = temp;

                state.isDirty = true;
            });
        },

        moveRootToIndex: (nodeId, newIndex) => {
            set((state) => {
                const idx = state.rootIds.indexOf(nodeId);
                if (idx < 0 || idx === newIndex) return;
                state.rootIds.splice(idx, 1);
                const clamped = Math.max(0, Math.min(newIndex, state.rootIds.length));
                state.rootIds.splice(clamped, 0, nodeId);
                state.isDirty = true;
            });
        },

        moveChildToIndex: (nodeId, newIndex) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node || !node.parentId) return;
                const parent = state.nodes[node.parentId];
                if (!parent) return;
                const idx = parent.children.indexOf(nodeId);
                if (idx < 0 || idx === newIndex) return;
                parent.children.splice(idx, 1);
                const clamped = Math.max(0, Math.min(newIndex, parent.children.length));
                parent.children.splice(clamped, 0, nodeId);
                state.isDirty = true;
            });
        },

        // ── SubNode Actions ─────────────────────────────────────────────────

        addSubNode: (nodeId, parentSubNodeId, text = 'New item') => {
            let newSubId = '';
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;

                const newSub = createSubNode(text, 'checklist');
                newSubId = newSub.id;

                if (parentSubNodeId) {
                    const parentSub = findSubNode(node.subNodes, parentSubNodeId);
                    if (parentSub) {
                        parentSub.subNodes.push(newSub);
                    }
                } else {
                    node.subNodes.push(newSub);
                }
                state.isDirty = true;
            });
            return newSubId;
        },

        addAttachmentSubNode: (nodeId, filePath, fileName) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;
                const newSub = createSubNode(fileName, 'attachment', filePath);
                node.subNodes.push(newSub);
                state.isDirty = true;
            });
        },

        deleteSubNode: (nodeId, subNodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;

                // First, find the subNode to check if it has a spawned MindMapNode
                const subNode = findSubNode(node.subNodes, subNodeId);
                if (subNode && subNode.childNodeId) {
                    // Delete the spawned MindMapNode subtree
                    const subtreeIds = collectSubtreeIds(state.nodes, subNode.childNodeId);
                    for (const id of subtreeIds) {
                        delete state.nodes[id];
                    }
                    for (const edgeId of Object.keys(state.edges)) {
                        const edge = state.edges[edgeId];
                        if (subtreeIds.includes(edge.sourceId) || subtreeIds.includes(edge.targetId)) {
                            delete state.edges[edgeId];
                        }
                    }
                    state.selectedNodeIds = state.selectedNodeIds.filter(
                        (id) => !subtreeIds.includes(id),
                    );
                }

                // Then remove the subNode itself
                removeSubNode(node.subNodes, subNodeId);
                state.isDirty = true;
            });
        },

        updateSubNodeText: (nodeId, subNodeId, text) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;

                const subNode = findSubNode(node.subNodes, subNodeId);
                if (!subNode) return;

                subNode.text = text;

                // Sync to spawned MindMapNode if promoted
                if (subNode.childNodeId) {
                    const spawnedNode = state.nodes[subNode.childNodeId];
                    if (spawnedNode) spawnedNode.text = text;
                }
                state.isDirty = true;
            });
        },

        toggleSubNodeChecked: (nodeId, subNodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;
                const subNode = findSubNode(node.subNodes, subNodeId);
                if (!subNode) return;

                subNode.checked = !subNode.checked;

                // If this node was spawned from a subnode, we may need to sync the original subnode
                if (node.parentSubNodeId && node.parentId) {
                    const ownerNode = state.nodes[node.parentId];
                    if (ownerNode) {
                        const originalSubNode = findSubNode(ownerNode.subNodes, node.parentSubNodeId);
                        if (originalSubNode && originalSubNode.type === 'checklist') {
                            // Check if all checklist subnodes in the current node are checked
                            let allChecked = true;
                            let hasChecklistItems = false;

                            const checkAll = (sns: SubNode[]) => {
                                for (const sn of sns) {
                                    if (sn.type === 'checklist') {
                                        hasChecklistItems = true;
                                        if (!sn.checked) {
                                            allChecked = false;
                                            return;
                                        }
                                    }
                                    checkAll(sn.subNodes);
                                }
                            };
                            checkAll(node.subNodes);

                            // If there are checklist items and all are checked, check the original.
                            // Otherwise, uncheck it.
                            if (hasChecklistItems) {
                                originalSubNode.checked = allChecked;
                            }
                        }
                    }
                }
                state.isDirty = true;
            });
        },

        toggleSubNodeCollapse: (nodeId, subNodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;
                const subNode = findSubNode(node.subNodes, subNodeId);
                if (subNode && subNode.childNodeId) subNode.collapsed = !subNode.collapsed;
                state.isDirty = true;
            });
        },

        promoteSubNode: (nodeId, subNodeId) => {
            let newNodeId: string | null = null;
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;

                const subNode = findSubNode(node.subNodes, subNodeId);
                if (!subNode || subNode.childNodeId) return; // Already promoted

                // Create new MindMapNode as child of the owning node
                const spawnedNode = createNode(subNode.text, nodeId, subNode.id);
                newNodeId = spawnedNode.id;
                state.nodes[spawnedNode.id] = spawnedNode;
                node.children.push(spawnedNode.id);

                // Link bidirectionally
                subNode.childNodeId = spawnedNode.id;

                // Create edge
                const edge = createEdge(nodeId, spawnedNode.id);
                state.edges[edge.id] = edge;

                // Expand parent if collapsed
                if (node.collapsed) node.collapsed = false;
                state.isDirty = true;
            });
            return newNodeId;
        },

        demoteNode: (spawnedNodeId) => {
            set((state) => {
                const spawnedNode = state.nodes[spawnedNodeId];
                if (!spawnedNode || !spawnedNode.parentSubNodeId || !spawnedNode.parentId) return;

                const ownerNode = state.nodes[spawnedNode.parentId];
                if (!ownerNode) return;

                const subNode = findSubNode(ownerNode.subNodes, spawnedNode.parentSubNodeId);
                if (!subNode) return;

                // Clear link
                subNode.childNodeId = null;

                // Remove spawned node subtree
                const subtreeIds = collectSubtreeIds(state.nodes, spawnedNodeId);

                // Remove from parent's children
                ownerNode.children = ownerNode.children.filter((id) => id !== spawnedNodeId);

                // Remove nodes and edges
                for (const id of subtreeIds) {
                    delete state.nodes[id];
                }
                for (const edgeId of Object.keys(state.edges)) {
                    const edge = state.edges[edgeId];
                    if (subtreeIds.includes(edge.sourceId) || subtreeIds.includes(edge.targetId)) {
                        delete state.edges[edgeId];
                    }
                }
                state.selectedNodeIds = state.selectedNodeIds.filter(
                    (id) => !subtreeIds.includes(id),
                );
                state.isDirty = true;
            });
        },

        reorderSubNode: (nodeId, subNodeId, newIndex) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;
                const idx = node.subNodes.findIndex((sn) => sn.id === subNodeId);
                if (idx < 0) return;
                const [removed] = node.subNodes.splice(idx, 1);
                const clampedIndex = Math.max(0, Math.min(newIndex, node.subNodes.length));
                node.subNodes.splice(clampedIndex, 0, removed);
                state.isDirty = true;
            });
        },

        updateSubNodeTimes: (nodeId, subNodeId, startTime, endTime, granularity) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;
                const subNode = findSubNode(node.subNodes, subNodeId);
                if (!subNode || subNode.type !== 'checklist') return;

                if (startTime === null) delete subNode.startTime;
                else subNode.startTime = startTime;

                if (endTime === null) delete subNode.endTime;
                else subNode.endTime = endTime;

                if (!subNode.startTime && !subNode.endTime) {
                    delete subNode.timeGranularity;
                } else {
                    subNode.timeGranularity = granularity;
                }
                state.isDirty = true;
            });
        },

        // ── Links ─────────────────────────────────────────────────────────────

        addLink: (sourceId, targetId) => {
            const id = nanoid();
            set((state) => {
                // Don't create duplicate links or self-links
                if (sourceId === targetId) return;
                const exists = Object.values(state.links).some(
                    (l) => (l.sourceId === sourceId && l.targetId === targetId) ||
                        (l.sourceId === targetId && l.targetId === sourceId),
                );
                if (exists) return;
                state.links[id] = { id, sourceId, targetId };
                state.isDirty = true;
            });
            return id;
        },

        deleteLink: (linkId) => {
            set((state) => {
                delete state.links[linkId];
                if (state.selectedLinkId === linkId) state.selectedLinkId = null;
                state.isDirty = true;
            });
        },

        setLinkingSource: (nodeId) => {
            set((state) => {
                state.linkingSourceId = nodeId;
            });
        },

        selectLink: (linkId) => {
            set((state) => {
                state.selectedLinkId = linkId;
                if (linkId) state.selectedNodeIds = [];
            });
        },

        // ── Selection ───────────────────────────────────────────────────────

        setSelectedSubNode: (nodeId, subNodeId) => {
            set((state) => {
                state.selectedSubNodeId = subNodeId;
                state.selectedSubNodeParentId = nodeId;
            });
        },

        setSelection: (nodeIds) => {
            set((state) => {
                state.selectedNodeIds = nodeIds;
                state.selectedSubNodeId = null;
                state.selectedSubNodeParentId = null;
            });
        },

        toggleSelection: (nodeId) => {
            set((state) => {
                const idx = state.selectedNodeIds.indexOf(nodeId);
                if (idx >= 0) {
                    state.selectedNodeIds.splice(idx, 1);
                } else {
                    state.selectedNodeIds.push(nodeId);
                }
            });
        },

        clearSelection: () => {
            set((state) => {
                state.selectedNodeIds = [];
                state.selectedSubNodeId = null;
                state.selectedSubNodeParentId = null;
            });
        },

        // ── Viewport ────────────────────────────────────────────────────────

        panViewport: (dx, dy) => {
            set((state) => {
                state.viewport.x += dx;
                state.viewport.y += dy;
            });
        },

        zoomViewport: (zoom, _centerX, _centerY) => {
            set((state) => {
                state.viewport.zoom = Math.max(0.1, Math.min(3, zoom));
            });
        },

        setViewport: (viewport) => {
            set((state) => {
                state.viewport = viewport;
            });
        },

        fitViewToNodes: (stageWidth, stageHeight) => {
            set((state) => {
                // If there are no nodes, just reset to center
                const nodeIds = Object.keys(state.nodes);
                if (nodeIds.length === 0) {
                    state.viewport = { x: 0, y: 0, zoom: 1 };
                    return;
                }

                const visibleRootIds = state.rootIds.filter(id => !state.hiddenRootIds.includes(id));

                // Calculate an exact theoretical layout just for sizing
                const layout = computeLayout(state.nodes, visibleRootIds, {
                    nodeWidth: 200,
                    nodeBaseHeight: 44,
                    subNodeRowHeight: 32,
                    horizontalSpacing: 280, // 200 + 80
                    verticalSpacing: 24,
                });

                let minX = Infinity;
                let maxX = -Infinity;
                let minY = Infinity;
                let maxY = -Infinity;

                let forestMinY = Infinity;
                let forestMaxY = -Infinity;

                let hasValidLayout = false;
                for (const [nodeId, info] of layout.entries()) {
                    hasValidLayout = true;

                    forestMinY = Math.min(forestMinY, info.y);
                    forestMaxY = Math.max(forestMaxY, info.y + info.height);

                    // Apply any manual positions if any, otherwise layout position
                    const manualPos = state.manualPositions[nodeId];
                    const finalX = manualPos ? manualPos.x : info.x;
                    const finalY = manualPos ? manualPos.y : info.y;

                    minX = Math.min(minX, finalX);
                    maxX = Math.max(maxX, finalX + info.width);
                    minY = Math.min(minY, finalY);
                    maxY = Math.max(maxY, finalY + info.height);
                }

                if (!hasValidLayout) {
                    state.viewport = { x: 0, y: 0, zoom: 1 };
                    return;
                }

                if (forestMinY === Infinity) {
                    forestMinY = 0;
                    forestMaxY = 0;
                }

                // Add canvas rendering offsets (matches calculations in MindMapCanvas)
                const offsetX = stageWidth * 0.12;
                const forestHeight = forestMaxY - forestMinY;
                const offsetY = stageHeight / 2 - forestMinY - forestHeight / 2;

                minX += offsetX;
                maxX += offsetX;
                minY += offsetY;
                maxY += offsetY;

                if (!hasValidLayout) {
                    state.viewport = { x: 0, y: 0, zoom: 1 };
                    return;
                }

                const PADDING = 100;

                // Content dimensions
                const contentWidth = maxX - minX;
                const contentHeight = maxY - minY;

                // Scale required to fit
                const scaleX = (stageWidth - PADDING * 2) / contentWidth;
                const scaleY = (stageHeight - PADDING * 2) / contentHeight;

                // Choose minimum scale so both directions fit, bounded at max zoom 1
                const zoom = Math.max(0.1, Math.min(1, Math.min(scaleX, scaleY)));

                // Calculate center taking into account the new zoom level
                const contentCenterX = minX + contentWidth / 2;
                const contentCenterY = minY + contentHeight / 2;

                const newX = stageWidth / 2 - contentCenterX * zoom;
                const newY = stageHeight / 2 - contentCenterY * zoom;

                state.viewport = { x: newX, y: newY, zoom };
            });
        },

        // ── Panels ─────────────────────────────────────────────────────────

        toggleRootVisibility: (nodeId) => {
            set((state) => {
                if (state.hiddenRootIds.includes(nodeId)) {
                    state.hiddenRootIds = state.hiddenRootIds.filter(id => id !== nodeId);
                } else {
                    state.hiddenRootIds.push(nodeId);
                }
            });
            get().tidyUp(); // Auto layout whenever visibility toggled
        },

        toggleRootNodesPanel: () => {
            set((state) => {
                state.rootNodesPanelOpen = !state.rootNodesPanelOpen;
            });
        },

        toggleCalendar: () => {
            set((state) => {
                state.calendarOpen = !state.calendarOpen;
            });
        },

        setCalendarSplit: (split) => {
            set((state) => {
                state.calendarSplit = split;
            });
        },

        setConnectorStyle: (style) => {
            set((state) => {
                state.connectorStyle = style;
                // Also update the new fields for backward compat
                if (style === 'horizontal') {
                    state.connectorAnchor = 'horizontal';
                } else {
                    state.connectorAnchor = 'adaptive';
                    state.lineStyle = style as LineStyle;
                }
                state.isDirty = true;
            });
        },

        setConnectorAnchor: (anchor) => {
            set((state) => {
                state.connectorAnchor = anchor;
                state.isDirty = true;
            });
        },

        setLineStyle: (style) => {
            set((state) => {
                state.lineStyle = style;
                state.isDirty = true;
            });
        },

        setAppSettings: (patch) => {
            set((state) => {
                Object.assign(state.appSettings, patch);
            });
        },

        // ── Document ────────────────────────────────────────────────────────

        setTitle: (title) => set({ title, isDirty: true }),

        loadDocument: (doc) => {
            // Migrate legacy connectorStyle to new fields
            let anchor: ConnectorAnchor = doc.connectorAnchor ?? 'adaptive';
            let lineSt: LineStyle = doc.lineStyle ?? 'orthogonal';
            if (!doc.connectorAnchor && !doc.lineStyle && doc.connectorStyle) {
                // Legacy migration
                if (doc.connectorStyle === 'horizontal') {
                    anchor = 'horizontal';
                    lineSt = 'orthogonal';
                } else {
                    anchor = 'adaptive';
                    lineSt = doc.connectorStyle as LineStyle;
                }
            }
            set({
                ...doc,
                connectorAnchor: anchor,
                lineStyle: lineSt,
                selectedNodeIds: [],
                selectedSubNodeId: null,
                selectedSubNodeParentId: null,
                linkingSourceId: null,
                selectedLinkId: null,
                undoStack: [],
                redoStack: [],
                isDirty: false,
            });
        },

        toDocument: (): MindMapDocument => {
            const state = get();
            return {
                version: 1,
                title: state.title,
                rootIds: [...state.rootIds],
                nodes: JSON.parse(JSON.stringify(state.nodes)),
                edges: JSON.parse(JSON.stringify(state.edges)),
                links: JSON.parse(JSON.stringify(state.links)),
                manualPositions: JSON.parse(JSON.stringify(state.manualPositions)),
                theme: {
                    name: 'Default Dark',
                    mode: 'dark',
                    colors: {
                        background: '#0f0f14',
                        surface: '#1a1a24',
                        primary: '#6c63ff',
                        secondary: '#3ecfb2',
                        text: '#e8e8ed',
                        textMuted: '#8888a0',
                        border: '#2a2a3a',
                        accent: '#ff6b9d',
                    },
                    defaultNodeStyle: DEFAULT_NODE_STYLE,
                    defaultEdgeStyle: DEFAULT_EDGE_STYLE,
                },
                viewport: { ...state.viewport },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                connectorStyle: state.connectorStyle,
                connectorAnchor: state.connectorAnchor,
                lineStyle: state.lineStyle,
            };
        },

        newDocument: () => {
            set(() => ({
                ...createInitialState(),
                // preserve calendar state and theme if needed, but not required
                isDirty: false,
            }));
        },

        // ── History ──────────────────────────────────────────────────────────

        pushUndo: () => {
            set((state) => {
                const snapshot = JSON.stringify({
                    nodes: state.nodes,
                    edges: state.edges,
                    links: state.links,
                    rootIds: state.rootIds,
                    manualPositions: state.manualPositions,
                    title: state.title,
                });
                state.undoStack.push(snapshot);
                if (state.undoStack.length > 100) state.undoStack.shift();
                state.redoStack = [];
                state.isDirty = true;
            });
        },

        undo: () => {
            set((state) => {
                if (state.undoStack.length === 0) return;

                // Save current for redo
                const currentSnapshot = JSON.stringify({
                    nodes: state.nodes,
                    edges: state.edges,
                    rootIds: state.rootIds,
                    title: state.title,
                });
                state.redoStack.push(currentSnapshot);

                // Restore previous
                const prev = JSON.parse(state.undoStack.pop()!);
                state.nodes = prev.nodes;
                state.edges = prev.edges;
                state.rootIds = prev.rootIds;
                state.manualPositions = prev.manualPositions || {};
                state.title = prev.title;
                state.selectedNodeIds = [];
            });
        },

        redo: () => {
            set((state) => {
                if (state.redoStack.length === 0) return;

                // Save current for undo
                const currentSnapshot = JSON.stringify({
                    nodes: state.nodes,
                    edges: state.edges,
                    rootIds: state.rootIds,
                    title: state.title,
                });
                state.undoStack.push(currentSnapshot);

                // Restore next
                const next = JSON.parse(state.redoStack.pop()!);
                state.nodes = next.nodes;
                state.edges = next.edges;
                state.rootIds = next.rootIds;
                state.manualPositions = next.manualPositions || {};
                state.title = next.title;
                state.selectedNodeIds = [];
            });
        },

        setDirty: (dirty) => set({ isDirty: dirty }),
    })),
);
