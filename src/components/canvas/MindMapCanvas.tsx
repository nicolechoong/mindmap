import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Text, Line, Circle } from 'react-konva';
import type Konva from 'konva';
import { useMindMapStore } from '../../store/store';
import { computeLayout, type NodeLayoutInfo } from '../../layout/layout';
import { ContextMenu } from '../context/ContextMenu';
import type { MindMapNode, SubNode } from '../../types';

// ── Design constants ──────────────────────────────────────────────────────

const NODE_WIDTH = 200;
const MIN_TITLE_HEIGHT = 44;
const MIN_ROW_HEIGHT = 32;
const ROW_PADDING_X = 8;
const BORDER_RADIUS = 8;
const CONNECTOR_RADIUS = 5;
const TITLE_PAD_Y = 12;  // vertical padding inside title
const ROW_PAD_Y = 8;     // vertical padding inside subnode row
const LINE_HEIGHT_FACTOR = 1.35;

// Theme-aware color palettes
function getColors(theme: 'light' | 'dark') {
    if (theme === 'dark') {
        return {
            nodeBg: '#1e1e2a',
            nodeBorder: '#2e2e3e',
            titleBg: '#252535',
            titleText: '#e8e8ed',
            rowBg: '#1e1e2a',
            rowBorder: '#2a2a3a',
            rowText: '#c0c0d0',
            rowTextChecked: '#666680',
            checkboxBorder: '#555570',
            checkboxChecked: '#7c75ff',
            selectedRing: '#7c75ff',
            edgeColor: '#555570',
            edgePromoted: '#7c75ff',
            connectorBg: '#3a3a50',
            canvasBg: '#0f0f14',
            addBtnText: '#555570',
            rootBg: '#6c63ff',
            rootText: '#ffffff',
            rootBorder: '#5a52e0',
        };
    }
    return {
        nodeBg: '#ffffff',
        nodeBorder: '#e0e0e6',
        titleBg: '#f8f8fa',
        titleText: '#1a1a2e',
        rowBg: '#ffffff',
        rowBorder: '#eeeeee',
        rowText: '#333340',
        rowTextChecked: '#aaaaaa',
        checkboxBorder: '#cccccc',
        checkboxChecked: '#6c63ff',
        selectedRing: '#6c63ff',
        edgeColor: '#b0b0c0',
        edgePromoted: '#6c63ff',
        connectorBg: '#d8d8e0',
        canvasBg: '#f4f4f8',
        addBtnText: '#999',
        rootBg: '#6c63ff',
        rootText: '#ffffff',
        rootBorder: '#5a52e0',
    };
}

// ── Text Measurement ──────────────────────────────────────────────────────

const _measureCtx = document.createElement('canvas').getContext('2d')!;

function measureTextLines(
    text: string,
    maxWidth: number,
    fontSize: number,
    fontWeight: string = '',
): number {
    _measureCtx.font = `${fontWeight} ${fontSize}px Inter, sans-serif`.trim();
    if (!text || !text.trim()) return 1;
    const words = text.split(/\s+/);
    let lines = 1;
    let currentLine = '';
    for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        if (_measureCtx.measureText(testLine).width > maxWidth && currentLine !== '') {
            lines++;
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    }
    return lines;
}

function getTitleHeight(text: string, isRoot: boolean, hasCollapseBtn: boolean): number {
    const fontSize = isRoot ? 15 : 13;
    const fontWeight = isRoot ? 'bold' : '600';
    const btnSpace = hasCollapseBtn ? 20 : 0;
    const availWidth = NODE_WIDTH - ROW_PADDING_X * 2 - btnSpace;
    const lines = measureTextLines(text, availWidth, fontSize, fontWeight);
    const textH = lines * fontSize * LINE_HEIGHT_FACTOR;
    return Math.max(MIN_TITLE_HEIGHT, textH + TITLE_PAD_Y * 2);
}

function getRowHeight(text: string, depth: number, hasLink: boolean): number {
    const indent = depth * 14;
    const linkSpace = hasLink ? 16 : 0;
    const availWidth = NODE_WIDTH - ROW_PADDING_X * 2 - indent - 20 - linkSpace;
    const lines = measureTextLines(text, availWidth, 12);
    const textH = lines * 12 * LINE_HEIGHT_FACTOR;
    return Math.max(MIN_ROW_HEIGHT, textH + ROW_PAD_Y * 2);
}

// ── Helpers ───────────────────────────────────────────────────────────────

interface FlatSubNode {
    subNode: SubNode;
    depth: number;
    rowIndex: number;
}

function flattenSubNodes(subs: SubNode[], depth = 0, startIndex = 0): FlatSubNode[] {
    const result: FlatSubNode[] = [];
    let idx = startIndex;
    for (const sn of subs) {
        result.push({ subNode: sn, depth, rowIndex: idx });
        idx++;
        const nested = flattenSubNodes(sn.subNodes, depth + 1, idx);
        result.push(...nested);
        idx += nested.length;
    }
    return result;
}

function findSubNodeById(subs: SubNode[], id: string): SubNode | null {
    for (const sn of subs) {
        if (sn.id === id) return sn;
        const found = findSubNodeById(sn.subNodes, id);
        if (found) return found;
    }
    return null;
}

// ── Per-node Dimensions ───────────────────────────────────────────────────

interface SubNodeDim {
    id: string;
    height: number;
    yOffset: number; // y relative to start of subnode area
}

interface NodeDims {
    titleHeight: number;
    subNodeDims: SubNodeDim[];
    totalHeight: number;
}

function computeNodeDims(
    node: MindMapNode,
    isRoot: boolean,
): NodeDims {
    const titleHeight = getTitleHeight(node.text, isRoot, node.children.length > 0);
    const flatSubs = flattenSubNodes(node.subNodes);
    const subNodeDims: SubNodeDim[] = [];
    let yOffset = 0;
    for (const { subNode: sn, depth } of flatSubs) {
        const h = getRowHeight(sn.text, depth, !!sn.childNodeId);
        subNodeDims.push({ id: sn.id, height: h, yOffset });
        yOffset += h;
    }
    return {
        titleHeight,
        subNodeDims,
        totalHeight: titleHeight + yOffset,
    };
}

// ── Canvas Component ──────────────────────────────────────────────────────

interface MindMapCanvasProps {
    stageRef: React.RefObject<any>;
    theme: 'light' | 'dark';
}

export function MindMapCanvas({ stageRef, theme }: MindMapCanvasProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
    const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
    const [editingSubNodeId, setEditingSubNodeId] = useState<string | null>(null);
    const [ctxMenu, setCtxMenu] = useState<{
        x: number;
        y: number;
        nodeId: string;
        subNodeId?: string;
    } | null>(null);
    // Track live drag position for real-time edge updates
    const [draggingPos, setDraggingPos] = useState<{
        nodeId: string;
        x: number;
        y: number;
    } | null>(null);

    const COLORS = useMemo(() => getColors(theme), [theme]);

    const nodes = useMindMapStore((s) => s.nodes);
    const edges = useMindMapStore((s) => s.edges);
    const rootIds = useMindMapStore((s) => s.rootIds);
    const selectedNodeIds = useMindMapStore((s) => s.selectedNodeIds);
    const setSelection = useMindMapStore((s) => s.setSelection);
    const clearSelection = useMindMapStore((s) => s.clearSelection);
    const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);
    const pushUndo = useMindMapStore((s) => s.pushUndo);
    const updateNodeText = useMindMapStore((s) => s.updateNodeText);
    const updateSubNodeText = useMindMapStore((s) => s.updateSubNodeText);
    const toggleSubNodeChecked = useMindMapStore((s) => s.toggleSubNodeChecked);
    const addSubNode = useMindMapStore((s) => s.addSubNode);
    const promoteSubNode = useMindMapStore((s) => s.promoteSubNode);
    const viewport = useMindMapStore((s) => s.viewport);
    const zoomViewport = useMindMapStore((s) => s.zoomViewport);
    const setViewport = useMindMapStore((s) => s.setViewport);
    const manualPositions = useMindMapStore((s) => s.manualPositions);
    const setNodePosition = useMindMapStore((s) => s.setNodePosition);

    const stageZoom = viewport.zoom;
    const stagePos = { x: viewport.x, y: viewport.y };

    // Resize
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const updateSize = () =>
            setDimensions({ width: container.clientWidth, height: container.clientHeight });
        updateSize();
        const observer = new ResizeObserver(updateSize);
        observer.observe(container);
        return () => observer.disconnect();
    }, []);

    // Listen for edit-node events from keyboard
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setEditingNodeId(detail.nodeId);
            setEditingSubNodeId(null);
        };
        window.addEventListener('mindmap:edit-node', handler);
        return () => window.removeEventListener('mindmap:edit-node', handler);
    }, []);

    // Compute dimensions for all nodes (dynamic heights due to text wrapping)
    const nodeDims = useMemo(() => {
        const dims = new Map<string, NodeDims>();
        for (const [nodeId, node] of Object.entries(nodes)) {
            const isRoot = rootIds.includes(nodeId);
            dims.set(nodeId, computeNodeDims(node, isRoot));
        }
        return dims;
    }, [nodes, rootIds]);

    const nodeHeights = useMemo(() => {
        const heights = new Map<string, number>();
        for (const [nodeId, dims] of nodeDims) {
            heights.set(nodeId, dims.totalHeight);
        }
        return heights;
    }, [nodeDims]);

    // Layout
    const layout = useMemo(() => {
        return computeLayout(nodes, rootIds, {
            nodeWidth: NODE_WIDTH,
            nodeBaseHeight: MIN_TITLE_HEIGHT,
            subNodeRowHeight: MIN_ROW_HEIGHT,
            horizontalSpacing: NODE_WIDTH + 80,
            verticalSpacing: 24,
        }, nodeHeights);
    }, [nodes, rootIds, nodeHeights]);

    // Compute forest bounding box for centering
    const forestBounds = useMemo(() => {
        let minY = Infinity, maxY = -Infinity;
        for (const [, info] of layout) {
            minY = Math.min(minY, info.y);
            maxY = Math.max(maxY, info.y + info.height);
        }
        if (minY === Infinity) return { minY: 0, maxY: 0 };
        return { minY, maxY };
    }, [layout]);

    const offsetX = dimensions.width * 0.12;
    const forestHeight = forestBounds.maxY - forestBounds.minY;
    const offsetY = dimensions.height / 2 - forestBounds.minY - forestHeight / 2;

    // Wheel zoom
    const handleWheel = useCallback(
        (e: Konva.KonvaEventObject<WheelEvent>) => {
            e.evt.preventDefault();
            const scaleBy = 1.06;
            const newZoom = e.evt.deltaY < 0 ? stageZoom * scaleBy : stageZoom / scaleBy;
            zoomViewport(Math.max(0.15, Math.min(3, newZoom)));
        },
        [stageZoom, zoomViewport],
    );

    const handleStageDragEnd = useCallback(
        (e: Konva.KonvaEventObject<DragEvent>) => {
            if (e.target !== e.target.getStage()) return;
            const stage = e.target.getStage();
            if (!stage) return;
            setViewport({ x: stage.x(), y: stage.y(), zoom: stageZoom });
        },
        [setViewport, stageZoom],
    );

    const handleStageClick = useCallback(
        (e: Konva.KonvaEventObject<any>) => {
            if (e.target === e.target.getStage()) {
                clearSelection();
                setEditingNodeId(null);
                setEditingSubNodeId(null);
                setCtxMenu(null);
            }
        },
        [clearSelection],
    );

    // Inline editing
    const handleEditCommit = useCallback(
        (text: string) => {
            if (editingNodeId) {
                pushUndo();
                updateNodeText(editingNodeId, text);
            }
            setEditingNodeId(null);
        },
        [editingNodeId, pushUndo, updateNodeText],
    );

    const handleSubNodeEditCommit = useCallback(
        (nodeId: string, subNodeId: string, text: string) => {
            updateSubNodeText(nodeId, subNodeId, text);
            setEditingSubNodeId(null);
            setEditingNodeId(null);
        },
        [updateSubNodeText],
    );

    const getScreenPos = useCallback(
        (worldX: number, worldY: number) => ({
            x: worldX * stageZoom + stagePos.x,
            y: worldY * stageZoom + stagePos.y,
        }),
        [stageZoom, stagePos],
    );

    // Get effective position: live drag > manual override > layout-computed
    const getEffectivePos = useCallback(
        (nodeId: string) => {
            // During drag, use the live position
            if (draggingPos && draggingPos.nodeId === nodeId) {
                return { x: draggingPos.x, y: draggingPos.y };
            }
            const manual = manualPositions[nodeId];
            if (manual) return { x: manual.x + offsetX, y: manual.y + offsetY };
            const info = layout.get(nodeId);
            if (info) return { x: info.x + offsetX, y: info.y + offsetY };
            return { x: offsetX, y: offsetY };
        },
        [draggingPos, manualPositions, layout, offsetX, offsetY],
    );

    // Build edges using effective positions
    const edgeLines = useMemo(() => {
        const lines: { key: string; points: number[]; color: string; width: number }[] = [];

        for (const edge of Object.values(edges)) {
            const sourceInfo = layout.get(edge.sourceId);
            const targetInfo = layout.get(edge.targetId);
            if (!sourceInfo || !targetInfo) continue;

            const targetNode = nodes[edge.targetId];
            const sourceNode = nodes[edge.sourceId];
            const sourceDims = nodeDims.get(edge.sourceId);
            const targetDims = nodeDims.get(edge.targetId);

            const sPos = getEffectivePos(edge.sourceId);
            const tPos = getEffectivePos(edge.targetId);

            let sy = sPos.y + sourceInfo.height / 2;
            let isPromoted = false;

            if (targetNode?.parentSubNodeId && sourceNode && sourceDims) {
                const snDim = sourceDims.subNodeDims.find(d => d.id === targetNode.parentSubNodeId);
                if (snDim) {
                    sy = sPos.y + sourceDims.titleHeight + snDim.yOffset + snDim.height / 2;
                    isPromoted = true;
                }
            }

            const tTitleH = targetDims?.titleHeight ?? MIN_TITLE_HEIGHT;
            const sx = sPos.x + sourceInfo.width;
            const tx = tPos.x;
            const ty = tPos.y + tTitleH / 2;
            const cpx1 = sx + 40;
            const cpx2 = tx - 40;

            lines.push({
                key: edge.id,
                points: [sx, sy, cpx1, sy, cpx2, ty, tx, ty],
                color: isPromoted ? COLORS.edgePromoted : COLORS.edgeColor,
                width: isPromoted ? 2 : 1.5,
            });
        }

        return lines;
    }, [edges, layout, nodes, nodeDims, getEffectivePos, COLORS]);

    return (
        <div ref={containerRef} className="canvas-container" style={{ background: COLORS.canvasBg }}>
            <Stage
                ref={stageRef}
                width={dimensions.width}
                height={dimensions.height}
                draggable
                scaleX={stageZoom}
                scaleY={stageZoom}
                x={stagePos.x}
                y={stagePos.y}
                onWheel={handleWheel}
                onDragEnd={handleStageDragEnd}
                onClick={handleStageClick}
                onTap={handleStageClick}
                onContextMenu={(e) => e.evt.preventDefault()}
            >
                <Layer>
                    {/* Edges */}
                    {edgeLines.map((line) => (
                        <Line
                            key={line.key}
                            points={line.points}
                            stroke={line.color}
                            strokeWidth={line.width}
                            bezier
                            lineCap="round"
                            opacity={0.7}
                        />
                    ))}

                    {/* Nodes */}
                    {Array.from(layout.entries()).map(([nodeId, info]) => {
                        const node = nodes[nodeId];
                        if (!node) return null;
                        const isSelected = selectedNodeIds.includes(nodeId);
                        const isRoot = rootIds.includes(nodeId);
                        const ePos = getEffectivePos(nodeId);
                        const x = ePos.x;
                        const y = ePos.y;
                        const dims = nodeDims.get(nodeId)!;
                        const titleH = dims.titleHeight;
                        const h = dims.totalHeight;
                        const flatSubs = flattenSubNodes(node.subNodes);

                        return (
                            <Group
                                key={nodeId}
                                x={x}
                                y={y}
                                draggable
                                onDragStart={(e) => {
                                    e.cancelBubble = true;
                                    pushUndo();
                                }}
                                onDragMove={(e) => {
                                    e.cancelBubble = true;
                                    setDraggingPos({
                                        nodeId,
                                        x: e.target.x(),
                                        y: e.target.y(),
                                    });
                                }}
                                onDragEnd={(e) => {
                                    e.cancelBubble = true;
                                    setDraggingPos(null);
                                    const newX = e.target.x() - offsetX;
                                    const newY = e.target.y() - offsetY;
                                    setNodePosition(nodeId, newX, newY);
                                }}
                                onContextMenu={(e) => {
                                    e.evt.preventDefault();
                                    e.cancelBubble = true;
                                    setSelection([nodeId]);
                                    setCtxMenu({
                                        x: e.evt.clientX,
                                        y: e.evt.clientY,
                                        nodeId,
                                    });
                                }}
                            >
                                {/* Selection ring */}
                                {isSelected && (
                                    <Rect
                                        x={-3}
                                        y={-3}
                                        width={NODE_WIDTH + 6}
                                        height={h + 6}
                                        cornerRadius={BORDER_RADIUS + 2}
                                        stroke={COLORS.selectedRing}
                                        strokeWidth={2.5}
                                        fill="transparent"
                                        shadowColor={`${COLORS.selectedRing}40`}
                                        shadowBlur={12}
                                        listening={false}
                                    />
                                )}

                                {/* Card shadow */}
                                <Rect
                                    width={NODE_WIDTH}
                                    height={h}
                                    fill="transparent"
                                    cornerRadius={BORDER_RADIUS}
                                    shadowColor="rgba(0,0,0,0.08)"
                                    shadowBlur={12}
                                    shadowOffsetY={3}
                                    listening={false}
                                />

                                {/* Card body */}
                                <Rect
                                    width={NODE_WIDTH}
                                    height={h}
                                    fill={COLORS.nodeBg}
                                    stroke={isRoot ? COLORS.rootBorder : COLORS.nodeBorder}
                                    strokeWidth={1}
                                    cornerRadius={BORDER_RADIUS}
                                />

                                {/* Title section */}
                                <Rect
                                    width={NODE_WIDTH}
                                    height={titleH}
                                    fill={isRoot ? COLORS.rootBg : COLORS.titleBg}
                                    cornerRadius={
                                        flatSubs.length > 0
                                            ? [BORDER_RADIUS, BORDER_RADIUS, 0, 0]
                                            : BORDER_RADIUS
                                    }
                                />
                                {flatSubs.length > 0 && (
                                    <Line
                                        points={[0, titleH, NODE_WIDTH, titleH]}
                                        stroke={isRoot ? COLORS.rootBorder : COLORS.nodeBorder}
                                        strokeWidth={1}
                                        listening={false}
                                    />
                                )}
                                <Text
                                    x={ROW_PADDING_X}
                                    y={0}
                                    width={NODE_WIDTH - ROW_PADDING_X * 2 - (node.children.length > 0 ? 20 : 0)}
                                    height={titleH}
                                    text={node.text}
                                    fontSize={isRoot ? 15 : 13}
                                    fontFamily="Inter, sans-serif"
                                    fontStyle={isRoot ? 'bold' : '600'}
                                    fill={isRoot ? COLORS.rootText : COLORS.titleText}
                                    verticalAlign="middle"
                                    wrap="word"
                                    onClick={(e) => {
                                        e.cancelBubble = true;
                                        setSelection([nodeId]);
                                    }}
                                    onDblClick={(e) => {
                                        e.cancelBubble = true;
                                        setEditingNodeId(nodeId);
                                        setEditingSubNodeId(null);
                                    }}
                                />

                                {/* Collapse toggle */}
                                {node.children.length > 0 && (
                                    <Group
                                        x={NODE_WIDTH - 24}
                                        y={titleH / 2 - 8}
                                        onClick={(e) => {
                                            e.cancelBubble = true;
                                            toggleCollapse(nodeId);
                                        }}
                                    >
                                        <Rect width={16} height={16} fill="transparent" />
                                        <Text
                                            width={16}
                                            height={16}
                                            text={node.collapsed ? '▸' : '▾'}
                                            fontSize={12}
                                            fill={isRoot ? COLORS.rootText : COLORS.rowText}
                                            align="center"
                                            verticalAlign="middle"
                                        />
                                    </Group>
                                )}

                                {/* SubNode rows */}
                                {flatSubs.map(({ subNode: sn, depth, rowIndex }) => {
                                    const snDim = dims.subNodeDims[rowIndex];
                                    const rowY = titleH + (snDim?.yOffset ?? 0);
                                    const rowH = snDim?.height ?? MIN_ROW_HEIGHT;
                                    const indent = depth * 14;
                                    const isLastRow = rowIndex === flatSubs.length - 1;

                                    return (
                                        <Group
                                            key={sn.id}
                                            y={rowY}
                                            onContextMenu={(e) => {
                                                e.evt.preventDefault();
                                                e.cancelBubble = true;
                                                setCtxMenu({
                                                    x: e.evt.clientX,
                                                    y: e.evt.clientY,
                                                    nodeId,
                                                    subNodeId: sn.id,
                                                });
                                            }}
                                        >
                                            <Rect
                                                width={NODE_WIDTH}
                                                height={rowH}
                                                fill={COLORS.rowBg}
                                                cornerRadius={isLastRow ? [0, 0, BORDER_RADIUS, BORDER_RADIUS] : 0}
                                            />
                                            {!isLastRow && (
                                                <Line
                                                    points={[ROW_PADDING_X, rowH, NODE_WIDTH - ROW_PADDING_X, rowH]}
                                                    stroke={COLORS.rowBorder}
                                                    strokeWidth={0.5}
                                                    listening={false}
                                                />
                                            )}

                                            {/* Checkbox */}
                                            <Rect
                                                x={ROW_PADDING_X + indent}
                                                y={(rowH - 14) / 2}
                                                width={14}
                                                height={14}
                                                cornerRadius={3}
                                                stroke={sn.checked ? COLORS.checkboxChecked : COLORS.checkboxBorder}
                                                strokeWidth={1.5}
                                                fill={sn.checked ? COLORS.checkboxChecked : 'transparent'}
                                                onClick={(e) => {
                                                    e.cancelBubble = true;
                                                    pushUndo();
                                                    toggleSubNodeChecked(nodeId, sn.id);
                                                }}
                                            />
                                            {sn.checked && (
                                                <Text
                                                    x={ROW_PADDING_X + indent}
                                                    y={(rowH - 14) / 2}
                                                    width={14}
                                                    height={14}
                                                    text="✓"
                                                    fontSize={10}
                                                    fontStyle="bold"
                                                    fill="#fff"
                                                    align="center"
                                                    verticalAlign="middle"
                                                    listening={false}
                                                />
                                            )}

                                            {/* SubNode text */}
                                            <Text
                                                x={ROW_PADDING_X + indent + 20}
                                                y={0}
                                                width={NODE_WIDTH - ROW_PADDING_X * 2 - indent - 20 - (sn.childNodeId ? 16 : 0)}
                                                height={rowH}
                                                text={sn.text}
                                                fontSize={12}
                                                fontFamily="Inter, sans-serif"
                                                fill={sn.checked ? COLORS.rowTextChecked : COLORS.rowText}
                                                textDecoration={sn.checked ? 'line-through' : ''}
                                                verticalAlign="middle"
                                                wrap="word"
                                                onClick={(e) => {
                                                    e.cancelBubble = true;
                                                    setSelection([nodeId]);
                                                }}
                                                onDblClick={(e) => {
                                                    e.cancelBubble = true;
                                                    setEditingNodeId(nodeId);
                                                    setEditingSubNodeId(sn.id);
                                                }}
                                            />

                                            {/* Link indicator */}
                                            {sn.childNodeId && (
                                                <Circle
                                                    x={NODE_WIDTH - ROW_PADDING_X}
                                                    y={rowH / 2}
                                                    radius={4}
                                                    fill={COLORS.edgePromoted}
                                                    opacity={0.8}
                                                    listening={false}
                                                />
                                            )}

                                            {/* Promote button */}
                                            {!sn.childNodeId && (
                                                <Group
                                                    x={NODE_WIDTH - 8}
                                                    y={rowH / 2 - 8}
                                                    onClick={(e) => {
                                                        e.cancelBubble = true;
                                                        pushUndo();
                                                        promoteSubNode(nodeId, sn.id);
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        const c = e.target.getStage()?.container();
                                                        if (c) c.style.cursor = 'pointer';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        const c = e.target.getStage()?.container();
                                                        if (c) c.style.cursor = 'default';
                                                    }}
                                                >
                                                    <Rect width={16} height={16} fill="transparent" />
                                                    <Text
                                                        width={16}
                                                        height={16}
                                                        text="⤴"
                                                        fontSize={11}
                                                        fill={COLORS.addBtnText}
                                                        align="center"
                                                        verticalAlign="middle"
                                                    />
                                                </Group>
                                            )}
                                        </Group>
                                    );
                                })}

                                {/* Left connector */}
                                {!rootIds.includes(nodeId) && (
                                    <Circle
                                        x={0}
                                        y={titleH / 2}
                                        radius={CONNECTOR_RADIUS}
                                        fill={COLORS.connectorBg}
                                        stroke={COLORS.nodeBorder}
                                        strokeWidth={1}
                                        listening={false}
                                    />
                                )}

                                {/* Add item button */}
                                <Group
                                    y={h - 2}
                                    onClick={(e) => {
                                        e.cancelBubble = true;
                                        pushUndo();
                                        addSubNode(nodeId);
                                    }}
                                    onMouseEnter={(e) => {
                                        const c = e.target.getStage()?.container();
                                        if (c) c.style.cursor = 'pointer';
                                    }}
                                    onMouseLeave={(e) => {
                                        const c = e.target.getStage()?.container();
                                        if (c) c.style.cursor = 'default';
                                    }}
                                >
                                    <Text
                                        x={0}
                                        y={4}
                                        width={NODE_WIDTH}
                                        height={20}
                                        text="+ add item"
                                        fontSize={11}
                                        fontFamily="Inter, sans-serif"
                                        fill={COLORS.addBtnText}
                                        align="center"
                                        verticalAlign="middle"
                                    />
                                </Group>
                            </Group>
                        );
                    })}
                </Layer>
            </Stage>

            {/* HTML overlays for inline editing */}
            {editingNodeId && !editingSubNodeId && (() => {
                const ePos = getEffectivePos(editingNodeId);
                const dims = nodeDims.get(editingNodeId);
                if (!dims) return null;
                const pos = getScreenPos(ePos.x, ePos.y);
                const isRoot = rootIds.includes(editingNodeId);
                const titleH = dims.titleHeight;
                return (
                    <textarea
                        key={`edit-${editingNodeId}`}
                        ref={(el) => {
                            if (el) {
                                el.focus();
                                el.select();
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                            }
                        }}
                        defaultValue={nodes[editingNodeId]?.text || ''}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleEditCommit((e.target as HTMLTextAreaElement).value);
                            } else if (e.key === 'Escape') setEditingNodeId(null);
                            e.stopPropagation();
                        }}
                        onInput={(e) => {
                            const el = e.target as HTMLTextAreaElement;
                            el.style.height = 'auto';
                            el.style.height = `${el.scrollHeight}px`;
                        }}
                        onBlur={(e) => handleEditCommit(e.target.value)}
                        rows={1}
                        style={{
                            position: 'absolute',
                            left: pos.x + 1,
                            top: pos.y + 1,
                            width: NODE_WIDTH * stageZoom - 2,
                            minHeight: titleH * stageZoom - 2,
                            paddingTop: TITLE_PAD_Y * stageZoom,
                            paddingBottom: TITLE_PAD_Y * stageZoom,
                            paddingLeft: ROW_PADDING_X * stageZoom,
                            paddingRight: ROW_PADDING_X * stageZoom,
                            fontSize: `${(isRoot ? 15 : 13) * stageZoom}px`,
                            fontFamily: 'Inter, sans-serif',
                            fontWeight: isRoot ? 700 : 600,
                            lineHeight: `${LINE_HEIGHT_FACTOR}`,
                            color: isRoot ? COLORS.rootText : COLORS.titleText,
                            background: isRoot ? COLORS.rootBg : COLORS.titleBg,
                            border: `2px solid ${COLORS.selectedRing}`,
                            borderRadius: `${BORDER_RADIUS * stageZoom}px`,
                            outline: 'none',
                            boxSizing: 'border-box' as const,
                            zIndex: 1000,
                            resize: 'none' as const,
                            overflow: 'hidden',
                        }}
                    />
                );
            })()}

            {editingNodeId && editingSubNodeId && (() => {
                const node = nodes[editingNodeId];
                const dims = nodeDims.get(editingNodeId);
                const ePos = getEffectivePos(editingNodeId);
                if (!dims || !node) return null;
                const snDim = dims.subNodeDims.find(d => d.id === editingSubNodeId);
                if (!snDim) return null;
                const pos = getScreenPos(ePos.x, ePos.y + dims.titleHeight + snDim.yOffset);
                const sn = findSubNodeById(node.subNodes, editingSubNodeId);

                // Find depth for indentation
                const flat = flattenSubNodes(node.subNodes);
                const flatEntry = flat.find(f => f.subNode.id === editingSubNodeId);
                const depth = flatEntry?.depth || 0;
                const indent = depth * 14;

                return (
                    <textarea
                        key={`edit-sn-${editingSubNodeId}`}
                        ref={(el) => {
                            if (el) {
                                el.focus();
                                el.select();
                                el.style.height = 'auto';
                                el.style.height = `${el.scrollHeight}px`;
                            }
                        }}
                        defaultValue={sn?.text || ''}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubNodeEditCommit(editingNodeId, editingSubNodeId, (e.target as HTMLTextAreaElement).value);
                            } else if (e.key === 'Escape') { setEditingSubNodeId(null); setEditingNodeId(null); }
                            e.stopPropagation();
                        }}
                        onInput={(e) => {
                            const el = e.target as HTMLTextAreaElement;
                            el.style.height = 'auto';
                            el.style.height = `${el.scrollHeight}px`;
                        }}
                        onBlur={(e) => handleSubNodeEditCommit(editingNodeId, editingSubNodeId, e.target.value)}
                        rows={1}
                        style={{
                            position: 'absolute',
                            left: pos.x + 1,
                            top: pos.y,
                            width: NODE_WIDTH * stageZoom - 2,
                            minHeight: snDim.height * stageZoom,
                            paddingTop: ROW_PAD_Y * stageZoom,
                            paddingBottom: ROW_PAD_Y * stageZoom,
                            paddingLeft: (ROW_PADDING_X + indent + 20) * stageZoom,
                            paddingRight: ROW_PADDING_X * stageZoom,
                            fontSize: `${12 * stageZoom}px`,
                            fontFamily: 'Inter, sans-serif',
                            lineHeight: `${LINE_HEIGHT_FACTOR}`,
                            color: COLORS.rowText,
                            background: COLORS.rowBg,
                            border: `2px solid ${COLORS.selectedRing}`,
                            borderRadius: `4px`,
                            outline: 'none',
                            boxSizing: 'border-box' as const,
                            zIndex: 1000,
                            resize: 'none' as const,
                            overflow: 'hidden',
                        }}
                    />
                );
            })()}

            {/* Context menu */}
            {ctxMenu && (
                <ContextMenu
                    x={ctxMenu.x}
                    y={ctxMenu.y}
                    nodeId={ctxMenu.nodeId}
                    subNodeId={ctxMenu.subNodeId}
                    onClose={() => setCtxMenu(null)}
                />
            )}
        </div>
    );
}
