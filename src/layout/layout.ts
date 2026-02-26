import type { MindMapNode } from '../types';

// ── Layout Configuration ──────────────────────────────────────────────────

export interface LayoutConfig {
    direction: 'horizontal' | 'vertical';
    horizontalSpacing: number;  // space between levels
    verticalSpacing: number;    // space between siblings
    nodeWidth: number;
    nodeBaseHeight: number;
    subNodeRowHeight: number;
}

const DEFAULT_CONFIG: LayoutConfig = {
    direction: 'horizontal',
    horizontalSpacing: 200,
    verticalSpacing: 20,
    nodeWidth: 160,
    nodeBaseHeight: 50,
    subNodeRowHeight: 24,
};

// ── Layout Result ─────────────────────────────────────────────────────────

export interface NodeLayoutInfo {
    x: number;
    y: number;
    width: number;
    height: number;
}

// ── Height Calculation ────────────────────────────────────────────────────

function calcNodeHeight(node: MindMapNode, config: LayoutConfig): number {
    let height = config.nodeBaseHeight;

    const countSubNodes = (subs: typeof node.subNodes): number => {
        let count = 0;
        for (const sn of subs) {
            count += 1;
            count += countSubNodes(sn.subNodes);
        }
        return count;
    };

    const subNodeCount = countSubNodes(node.subNodes);
    if (subNodeCount > 0) {
        height += subNodeCount * config.subNodeRowHeight + 8;
    }

    return height;
}

// ── Modified Reingold-Tilford Tree Layout ─────────────────────────────────

interface LayoutNode {
    id: string;
    width: number;
    height: number;
    children: LayoutNode[];
    x: number;
    y: number;
    subtreeHeight: number;
}

function buildLayoutTree(
    nodes: Record<string, MindMapNode>,
    nodeId: string,
    config: LayoutConfig,
    nodeHeights?: Map<string, number>,
): LayoutNode | null {
    const node = nodes[nodeId];
    if (!node) return null;

    const height = nodeHeights?.get(nodeId) ?? calcNodeHeight(node, config);

    // Collect IDs of children whose promoter subnode is collapsed
    const collapsedChildIds = new Set<string>();
    const gatherCollapsed = (subs: typeof node.subNodes) => {
        for (const sn of subs) {
            if (sn.childNodeId && sn.collapsed) {
                collapsedChildIds.add(sn.childNodeId);
            }
            gatherCollapsed(sn.subNodes);
        }
    };
    gatherCollapsed(node.subNodes);

    const children: LayoutNode[] = [];
    if (!node.collapsed) {
        for (const childId of node.children) {
            if (collapsedChildIds.has(childId)) continue;
            const childLayout = buildLayoutTree(nodes, childId, config, nodeHeights);
            if (childLayout) children.push(childLayout);
        }
    }

    return {
        id: nodeId,
        width: config.nodeWidth,
        height,
        children,
        x: 0,
        y: 0,
        subtreeHeight: 0,
    };
}

function computeSubtreeHeight(node: LayoutNode, config: LayoutConfig): number {
    if (node.children.length === 0) {
        node.subtreeHeight = node.height;
        return node.subtreeHeight;
    }

    let totalChildrenHeight = 0;
    for (let i = 0; i < node.children.length; i++) {
        totalChildrenHeight += computeSubtreeHeight(node.children[i], config);
        if (i < node.children.length - 1) {
            totalChildrenHeight += config.verticalSpacing;
        }
    }

    node.subtreeHeight = Math.max(node.height, totalChildrenHeight);
    return node.subtreeHeight;
}

function assignPositions(
    node: LayoutNode,
    x: number,
    yStart: number,
    config: LayoutConfig,
): void {
    node.x = x;
    node.y = yStart + node.subtreeHeight / 2 - node.height / 2;

    if (node.children.length === 0) return;

    const childX = x + config.horizontalSpacing;
    let currentY = yStart + (node.subtreeHeight - sumChildrenHeight(node, config)) / 2;

    for (let i = 0; i < node.children.length; i++) {
        assignPositions(node.children[i], childX, currentY, config);
        currentY += node.children[i].subtreeHeight + config.verticalSpacing;
    }
}

function sumChildrenHeight(node: LayoutNode, config: LayoutConfig): number {
    let total = 0;
    for (let i = 0; i < node.children.length; i++) {
        total += node.children[i].subtreeHeight;
        if (i < node.children.length - 1) total += config.verticalSpacing;
    }
    return total;
}

function flattenLayout(
    node: LayoutNode,
    result: Map<string, NodeLayoutInfo>,
): void {
    result.set(node.id, {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
    });
    for (const child of node.children) {
        flattenLayout(child, result);
    }
}

// ── Public API ────────────────────────────────────────────────────────────

/** Spacing between separate root trees. */
const TREE_GAP = 60;

/**
 * Compute layout positions for all visible nodes in the mind map.
 * Supports multiple root nodes — each tree is laid out independently
 * and stacked vertically with TREE_GAP spacing.
 */
export function computeLayout(
    nodes: Record<string, MindMapNode>,
    rootIds: string | string[],
    config: Partial<LayoutConfig> = {},
    nodeHeights?: Map<string, number>,
): Map<string, NodeLayoutInfo> {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    const result = new Map<string, NodeLayoutInfo>();

    // Normalize to array for backward compat
    const ids = Array.isArray(rootIds) ? rootIds : [rootIds];

    // Build, measure, and position each tree
    const trees: LayoutNode[] = [];
    for (const rootId of ids) {
        const tree = buildLayoutTree(nodes, rootId, mergedConfig, nodeHeights);
        if (tree) {
            computeSubtreeHeight(tree, mergedConfig);
            trees.push(tree);
        }
    }

    // Stack trees vertically
    let currentY = 0;
    for (let i = 0; i < trees.length; i++) {
        assignPositions(trees[i], 0, currentY, mergedConfig);
        flattenLayout(trees[i], result);
        currentY += trees[i].subtreeHeight + TREE_GAP;
    }

    return result;
}

/**
 * Apply computed layout positions back to the store nodes.
 */
export function applyLayout(
    nodes: Record<string, MindMapNode>,
    layout: Map<string, NodeLayoutInfo>,
): void {
    for (const [nodeId, info] of layout) {
        const node = nodes[nodeId];
        if (node) {
            node.position = { x: info.x, y: info.y };
        }
    }
}
