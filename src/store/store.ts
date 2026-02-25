import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
    MindMapNode,
    MindMapEdge,
    SubNode,
    NodeStyle,
    EdgeStyle,
    ThemeConfig,
    ViewportState,
    MindMapDocument,
} from '../types';

// ── Default styles ────────────────────────────────────────────────────────

const DEFAULT_NODE_STYLE: NodeStyle = {
    fillColor: '#2a2a3a',
    strokeColor: '#6c63ff',
    textColor: '#e8e8ed',
    fontSize: 14,
    fontWeight: 'normal',
    shape: 'rounded',
};

const ROOT_NODE_STYLE: NodeStyle = {
    fillColor: '#6c63ff',
    strokeColor: '#7f78ff',
    textColor: '#ffffff',
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

function createSubNode(text: string): SubNode {
    return {
        id: nanoid(),
        text,
        checked: false,
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
    rootIds: string[];
    manualPositions: Record<string, { x: number; y: number }>;
    selectedNodeIds: string[];
    viewport: ViewportState;
    title: string;

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
    reparentNode: (nodeId: string, newParentId: string) => void;
    setNodePosition: (nodeId: string, x: number, y: number) => void;
    tidyUp: () => void;

    // SubNode actions
    addSubNode: (nodeId: string, parentSubNodeId?: string, text?: string) => void;
    deleteSubNode: (nodeId: string, subNodeId: string) => void;
    updateSubNodeText: (nodeId: string, subNodeId: string, text: string) => void;
    toggleSubNodeChecked: (nodeId: string, subNodeId: string) => void;
    promoteSubNode: (nodeId: string, subNodeId: string) => string | null;
    demoteNode: (spawnedNodeId: string) => void;

    // Selection
    setSelection: (nodeIds: string[]) => void;
    toggleSelection: (nodeId: string) => void;
    clearSelection: () => void;

    // Viewport
    panViewport: (dx: number, dy: number) => void;
    zoomViewport: (zoom: number, centerX?: number, centerY?: number) => void;
    setViewport: (viewport: ViewportState) => void;

    // Document
    setTitle: (title: string) => void;
    loadDocument: (doc: MindMapDocument) => void;
    toDocument: () => MindMapDocument;
    newDocument: () => void;

    // History
    pushUndo: () => void;
    undo: () => void;
    redo: () => void;
}

// ── Initial state ─────────────────────────────────────────────────────────

function createInitialState() {
    const rootNode = createNode('Central Idea', null, null, ROOT_NODE_STYLE);
    return {
        nodes: { [rootNode.id]: rootNode },
        edges: {} as Record<string, MindMapEdge>,
        rootIds: [rootNode.id],
        manualPositions: {} as Record<string, { x: number; y: number }>,
        selectedNodeIds: [] as string[],
        viewport: { x: 0, y: 0, zoom: 1 },
        title: 'Untitled Mind Map',
        undoStack: [] as string[],
        redoStack: [] as string[],
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
            });
            return newNodeId;
        },

        addChildNode: (parentId, text = 'New Idea') => {
            let newNodeId = '';
            set((state) => {
                const parent = state.nodes[parentId];
                if (!parent) return;

                const child = createNode(text, parentId);
                newNodeId = child.id;
                state.nodes[child.id] = child;
                parent.children.push(child.id);

                const edge = createEdge(parentId, child.id);
                state.edges[edge.id] = edge;

                // Expand parent if collapsed
                if (parent.collapsed) parent.collapsed = false;
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
                    return;
                }

                const parent = state.nodes[sibling.parentId];
                if (!parent) return;

                const newNode = createNode(text, parent.id);
                newNodeId = newNode.id;
                state.nodes[newNode.id] = newNode;

                // Insert after sibling
                const index = parent.children.indexOf(siblingId);
                parent.children.splice(index + 1, 0, newNode.id);

                const edge = createEdge(parent.id, newNode.id);
                state.edges[edge.id] = edge;
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

                // Remove all nodes and their edges
                for (const id of subtreeIds) {
                    delete state.nodes[id];
                }
                for (const edgeId of Object.keys(state.edges)) {
                    const edge = state.edges[edgeId];
                    if (subtreeIds.includes(edge.sourceId) || subtreeIds.includes(edge.targetId)) {
                        delete state.edges[edgeId];
                    }
                }

                // Clean selection
                state.selectedNodeIds = state.selectedNodeIds.filter(
                    (id) => !subtreeIds.includes(id),
                );
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
            });
        },

        updateNodeNotes: (nodeId, notes) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (node) node.notes = notes;
            });
        },

        updateNodeStyle: (nodeId, style) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (node) {
                    node.style = { ...node.style, ...style };
                }
            });
        },

        toggleCollapse: (nodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (node) node.collapsed = !node.collapsed;
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
            });
        },

        setNodePosition: (nodeId, x, y) => {
            set((state) => {
                state.manualPositions[nodeId] = { x, y };
            });
        },

        tidyUp: () => {
            set((state) => {
                state.manualPositions = {};
            });
        },

        // ── SubNode Actions ─────────────────────────────────────────────────

        addSubNode: (nodeId, parentSubNodeId, text = 'New item') => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;

                const newSub = createSubNode(text);

                if (parentSubNodeId) {
                    const parentSub = findSubNode(node.subNodes, parentSubNodeId);
                    if (parentSub) {
                        parentSub.subNodes.push(newSub);
                    }
                } else {
                    node.subNodes.push(newSub);
                }
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
            });
        },

        toggleSubNodeChecked: (nodeId, subNodeId) => {
            set((state) => {
                const node = state.nodes[nodeId];
                if (!node) return;
                const subNode = findSubNode(node.subNodes, subNodeId);
                if (subNode) subNode.checked = !subNode.checked;
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
            });
        },

        // ── Selection ───────────────────────────────────────────────────────

        setSelection: (nodeIds) => {
            set((state) => {
                state.selectedNodeIds = nodeIds;
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

        // ── Document ────────────────────────────────────────────────────────

        setTitle: (title) => {
            set((state) => {
                state.title = title;
            });
        },

        loadDocument: (doc) => {
            set((state) => {
                state.nodes = doc.nodes;
                state.edges = doc.edges;
                // Support legacy single-root docs
                state.rootIds = doc.rootIds ?? ((doc as any).rootId ? [(doc as any).rootId] : []);
                state.manualPositions = {};
                state.title = doc.title;
                state.viewport = doc.viewport;
                state.selectedNodeIds = [];
                state.undoStack = [];
                state.redoStack = [];
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
            };
        },

        newDocument: () => {
            set(() => createInitialState());
        },

        // ── History ──────────────────────────────────────────────────────────

        pushUndo: () => {
            set((state) => {
                const snapshot = JSON.stringify({
                    nodes: state.nodes,
                    edges: state.edges,
                    rootIds: state.rootIds,
                    manualPositions: state.manualPositions,
                    title: state.title,
                });
                state.undoStack.push(snapshot);
                if (state.undoStack.length > 100) state.undoStack.shift();
                state.redoStack = [];
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
    })),
);
