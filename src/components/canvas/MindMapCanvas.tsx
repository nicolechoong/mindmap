import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Stage, Layer, Group, Rect, Text, Line, Circle, Path } from 'react-konva';
import type Konva from 'konva';
import { useMindMapStore } from '../../store/store';
import { computeLayout, type NodeLayoutInfo } from '../../layout/layout';
import { ContextMenu } from '../context/ContextMenu';
import { DateTimePicker } from '../picker/DateTimePicker';
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
const TIME_BADGE_HEIGHT = 18; // height of the time pill badge row

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
            rootText: '#ffffff',
            timeBadgePlanned: { bg: '#1e2a3a', text: '#7ab8e0' },   // muted blue
            timeBadgeDeadline: { bg: '#3a2a1e', text: '#e0a87a' },   // muted orange
            timeBadgeSlot: { bg: '#1e3a2a', text: '#7ae0a8' },   // muted green
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
        rootText: '#ffffff',
        timeBadgePlanned: { bg: '#e0eef8', text: '#2a6595' },
        timeBadgeDeadline: { bg: '#f8ebe0', text: '#95612a' },
        timeBadgeSlot: { bg: '#e0f8eb', text: '#2a9561' },
    };
}

// Derive a darker shade for borders from a hex color
function darkenHex(hex: string, amount = 0.15): string {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
    const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
    const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Determine if we should use dark or light text for a given background hex
function getContrastColor(hexColor: string): string {
    const cleanHex = hexColor.replace('#', '');
    const r = parseInt(cleanHex.slice(0, 2), 16);
    const g = parseInt(cleanHex.slice(2, 4), 16);
    const b = parseInt(cleanHex.slice(4, 6), 16);
    // Relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1a1a2e' : '#ffffff';
}

// ── Text Measurement ──────────────────────────────────────────────────────

const _measureCtx = document.createElement('canvas').getContext('2d')!;

function wrapTextWithNewlines(
    text: string,
    maxWidth: number,
    fontSize: number,
    fontWeight = '',
): string {
    _measureCtx.font = `${fontWeight} ${fontSize}px Inter, sans-serif`.trim();
    if (!text || !text.trim()) return text;

    const paragraphs = text.split('\n');
    let finalResult = '';

    for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i];
        if (!paragraph) {
            if (i < paragraphs.length - 1) finalResult += '\n';
            continue;
        }

        const words = paragraph.split(/(\s+)/);
        let result = '';
        let currentLine = '';

        for (const word of words) {
            if (!word) continue;
            
            if (_measureCtx.measureText(word).width > maxWidth) {
                // Word is too long, must break it by character
                for (const char of word) {
                    const testLine = currentLine + char;
                    if (_measureCtx.measureText(testLine).width > maxWidth && currentLine !== '') {
                        result += currentLine + '\n';
                        currentLine = char;
                    } else {
                        currentLine = testLine;
                    }
                }
            } else {
                const testLine = currentLine + word;
                if (_measureCtx.measureText(testLine).width > maxWidth && currentLine.trim() !== '') {
                    // Remove trailing spaces on lines that wrap
                    result += currentLine.replace(/\s+$/, '') + '\n';
                    currentLine = word.trimStart();
                } else {
                    currentLine = testLine;
                }
            }
        }
        result += currentLine;
        
        finalResult += result;
        if (i < paragraphs.length - 1) {
            finalResult += '\n';
        }
    }
    
    return finalResult;
}

function measureTextLines(
    text: string,
    maxWidth: number,
    fontSize: number,
    fontWeight = '',
): number {
    const wrappedStr = wrapTextWithNewlines(text, maxWidth, fontSize, fontWeight);
    if (!wrappedStr) return 1;
    return wrappedStr.split('\n').length;
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

function getRowHeight(text: string, depth: number, hasLink: boolean, hasTime = false): number {
    const indent = depth * 14;
    const linkSpace = hasLink ? 16 : 0;
    const availWidth = NODE_WIDTH - ROW_PADDING_X * 2 - indent - 20 - linkSpace;
    const lines = measureTextLines(text, availWidth, 12);
    const textH = lines * 12 * LINE_HEIGHT_FACTOR;
    const badgeH = hasTime ? TIME_BADGE_HEIGHT : 0;
    return Math.max(MIN_ROW_HEIGHT, Math.ceil(textH + badgeH + ROW_PAD_Y * 2));
}

// ── Time Badge Helpers ────────────────────────────────────────────────────

function formatTimeLabel(startTime?: string, endTime?: string, granularity?: 'date' | 'datetime'): { text: string; type: 'planned' | 'deadline' | 'slot' } | null {
    if (!startTime && !endTime) return null;

    const fmt = (iso: string): string => {
        if (!iso) return '';
        const isDate = iso.length <= 10;
        if (isDate) {
            const d = new Date(iso + 'T00:00:00');
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
            d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    const fmtTimeOnly = (iso: string): string => {
        const d = new Date(iso);
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    };

    if (startTime && endTime) {
        // Same day with times → show "Mar 2 14:00 → 15:00"
        const sameDay = startTime.slice(0, 10) === endTime.slice(0, 10);
        if (sameDay && granularity === 'datetime') {
            return { text: `📅 ${fmt(startTime)} → ${fmtTimeOnly(endTime)}`, type: 'slot' };
        }
        return { text: `📅 ${fmt(startTime)} → ${fmt(endTime)}`, type: 'slot' };
    }
    if (startTime) {
        return { text: `📅 ${fmt(startTime)}`, type: 'planned' };
    }
    return { text: `⏰ ${fmt(endTime!)}`, type: 'deadline' };
}

function subNodeHasTime(sn: SubNode): boolean {
    return !!(sn.startTime || sn.endTime);
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
    if (node.subNodesCollapsed && node.subNodes.length > 0) {
        // When sub-items are collapsed, show a compact indicator row
        const indicatorHeight = 20;
        return {
            titleHeight,
            subNodeDims: [],
            totalHeight: titleHeight + indicatorHeight,
        };
    }
    const flatSubs = flattenSubNodes(node.subNodes);
    const subNodeDims: SubNodeDim[] = [];
    let yOffset = 0;
    for (const { subNode: sn, depth } of flatSubs) {
        const h = getRowHeight(sn.text, depth, !!sn.childNodeId, subNodeHasTime(sn));
        subNodeDims.push({ id: sn.id, height: h, yOffset });
        yOffset += h;
    }
    return {
        titleHeight,
        subNodeDims,
        totalHeight: titleHeight + yOffset,
    };
}

// ── Inline Editor Component ───────────────────────────────────────────────

interface InlineEditorProps {
    defaultValue: string;
    onCommit: (val: string) => void;
    onCancel: () => void;
    className?: string;
    style: React.CSSProperties;
}

function InlineEditor({ defaultValue, onCommit, onCancel, style }: InlineEditorProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = textareaRef.current;
        if (el) {
            el.focus();
            el.select();
            // Initial height sync
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }
    }, []);

    const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
        const el = e.currentTarget;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onCommit(e.currentTarget.value);
        } else if (e.key === 'Escape') {
            onCancel();
        }
        e.stopPropagation();
    };

    return (
        <textarea
            ref={textareaRef}
            defaultValue={defaultValue}
            onInput={handleInput}
            onKeyDown={handleKeyDown}
            onBlur={(e) => onCommit(e.target.value)}
            rows={1}
            style={{
                ...style,
                outline: 'none',
                resize: 'none',
                overflow: 'hidden',
                boxSizing: 'border-box',
                zIndex: 1000,
            }}
        />
    );
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
    const [timePicker, setTimePicker] = useState<{ x: number; y: number; nodeId: string; subNodeId: string } | null>(null);
    const [selectedBadge, setSelectedBadge] = useState<{ nodeId: string, subNodeId: string } | null>(null);

    const COLORS = useMemo(() => getColors(theme), [theme]);

    const nodes = useMindMapStore((s) => s.nodes);
    const edges = useMindMapStore((s) => s.edges);
    const rootIds = useMindMapStore((s) => s.rootIds);
    const hiddenRootIds = useMindMapStore((s) => s.hiddenRootIds);
    const selectedNodeIds = useMindMapStore((s) => s.selectedNodeIds);
    const setSelection = useMindMapStore((s) => s.setSelection);
    const clearSelection = useMindMapStore((s) => s.clearSelection);
    const toggleCollapse = useMindMapStore((s) => s.toggleCollapse);
    const reparentNode = useMindMapStore((s) => s.reparentNode);
    const pushUndo = useMindMapStore((s) => s.pushUndo);
    const updateNodeText = useMindMapStore((s) => s.updateNodeText);
    const updateSubNodeText = useMindMapStore((s) => s.updateSubNodeText);
    const updateSubNodeTimes = useMindMapStore((s) => s.updateSubNodeTimes);
    const toggleSubNodeChecked = useMindMapStore((s) => s.toggleSubNodeChecked);
    const toggleSubNodeCollapse = useMindMapStore((s) => s.toggleSubNodeCollapse);
    const addSubNode = useMindMapStore((s) => s.addSubNode);
    const addAttachmentSubNode = useMindMapStore((s) => s.addAttachmentSubNode);
    const promoteSubNode = useMindMapStore((s) => s.promoteSubNode);
    const reorderSubNode = useMindMapStore((s) => s.reorderSubNode);
    const selectedSubNodeId = useMindMapStore((s) => s.selectedSubNodeId);
    const selectedSubNodeParentId = useMindMapStore((s) => s.selectedSubNodeParentId);
    const setSelectedSubNode = useMindMapStore((s) => s.setSelectedSubNode);
    const viewport = useMindMapStore((s) => s.viewport);
    const zoomViewport = useMindMapStore((s) => s.zoomViewport);
    const setViewport = useMindMapStore((s) => s.setViewport);
    const manualPositions = useMindMapStore((s) => s.manualPositions);
    const setNodePosition = useMindMapStore((s) => s.setNodePosition);
    const links = useMindMapStore((s) => s.links);
    const connectorStyle = useMindMapStore((s) => s.connectorStyle);
    const connectorAnchor = useMindMapStore((s) => s.connectorAnchor);
    const lineStyle = useMindMapStore((s) => s.lineStyle);
    const linkingSourceId = useMindMapStore((s) => s.linkingSourceId);
    const selectedLinkId = useMindMapStore((s) => s.selectedLinkId);
    const addLink = useMindMapStore((s) => s.addLink);
    const setLinkingSource = useMindMapStore((s) => s.setLinkingSource);
    const selectLink = useMindMapStore((s) => s.selectLink);
    const deleteLink = useMindMapStore((s) => s.deleteLink);
    const moveRootToIndex = useMindMapStore((s) => s.moveRootToIndex);
    const moveChildToIndex = useMindMapStore((s) => s.moveChildToIndex);
    const setNodeSide = useMindMapStore((s) => s.setNodeSide);

    const stageZoom = viewport.zoom;
    const stagePos = { x: viewport.x, y: viewport.y };

    // Link interaction state
    const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
    const [linkingMousePos, setLinkingMousePos] = useState<{ x: number; y: number } | null>(null);
    const linkModeRef = useRef(false);
    linkModeRef.current = !!linkingSourceId;

    // Link right-click context menu
    const [linkCtxMenu, setLinkCtxMenu] = useState<{
        x: number;
        y: number;
        linkId: string;
    } | null>(null);

    // Navigation history for trace-back
    const [navHistory, setNavHistory] = useState<Array<{
        viewport: { x: number; y: number; zoom: number };
        selectedNodeIds: string[];
    }>>([]);

    // File drag-and-drop state
    const [dropTargetNodeId, setDropTargetNodeId] = useState<string | null>(null);

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

    // Listen for edit-subnode events
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            setEditingNodeId(detail.nodeId);
            setEditingSubNodeId(detail.subNodeId);
        };
        window.addEventListener('mindmap:edit-subnode', handler);
        return () => window.removeEventListener('mindmap:edit-subnode', handler);
    }, []);

    useEffect(() => {
        const handleBadgeDelete = (e: KeyboardEvent) => {
            if (!selectedBadge) return;
            // Don't handle if typing in an input/textarea
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                pushUndo();
                updateSubNodeTimes(selectedBadge.nodeId, selectedBadge.subNodeId, null, null, 'date');
                setSelectedBadge(null);
            }
        };
        window.addEventListener('keydown', handleBadgeDelete);
        return () => window.removeEventListener('keydown', handleBadgeDelete);
    }, [selectedBadge, updateSubNodeTimes, pushUndo]);

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
    const visibleRootIds = useMemo(() => rootIds.filter(id => !hiddenRootIds.includes(id)), [rootIds, hiddenRootIds]);
    const layout = useMemo(() => {
        return computeLayout(nodes, visibleRootIds, {
            nodeWidth: NODE_WIDTH,
            nodeBaseHeight: MIN_TITLE_HEIGHT,
            subNodeRowHeight: MIN_ROW_HEIGHT,
            horizontalSpacing: NODE_WIDTH + 80,
            verticalSpacing: 24,
        }, nodeHeights, manualPositions);
    }, [nodes, visibleRootIds, nodeHeights, manualPositions]);

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

    // Compute total bounds of all nodes (including layout and manual positions)
    const totalBounds = useMemo(() => {
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let hasNodes = false;
        for (const [nodeId, dims] of nodeDims) {
            hasNodes = true;
            const manual = manualPositions[nodeId];
            const info = layout.get(nodeId);
            const x = manual ? manual.x : (info ? info.x : 0);
            const y = manual ? manual.y : (info ? info.y : 0);
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x + (info ? info.width : NODE_WIDTH));
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y + dims.totalHeight);
        }
        if (!hasNodes) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        return { minX, maxX, minY, maxY };
    }, [nodeDims, manualPositions, layout]);

    const offsetX = dimensions.width * 0.12;
    const forestHeight = forestBounds.maxY - forestBounds.minY;
    const offsetY = dimensions.height / 2 - forestBounds.minY - forestHeight / 2;

    const clampViewport = useCallback((newX: number, newY: number, zoom: number) => {
        let { minX, maxX, minY, maxY } = totalBounds;

        minX += offsetX;
        maxX += offsetX;
        minY += offsetY;
        maxY += offsetY;

        const marginX = Math.min(200, dimensions.width / 2);
        const marginY = Math.min(200, dimensions.height / 2);

        const limitMinX = marginX - maxX * zoom;
        const limitMaxX = dimensions.width - marginX - minX * zoom;
        const limitMinY = marginY - maxY * zoom;
        const limitMaxY = dimensions.height - marginY - minY * zoom;

        const clamp = (val: number, min: number, max: number) => {
            if (min > max) return Math.max(max, Math.min(min, val));
            return Math.max(min, Math.min(max, val));
        };

        return {
            x: clamp(newX, limitMinX, limitMaxX),
            y: clamp(newY, limitMinY, limitMaxY)
        };
    }, [totalBounds, offsetX, offsetY, dimensions]);

    // Wheel zoom / pan
    const handleWheel = useCallback(
        (e: Konva.KonvaEventObject<WheelEvent>) => {
            e.evt.preventDefault();
            if (e.evt.ctrlKey || e.evt.metaKey) {
                const scaleBy = 1.06;
                const newZoom = e.evt.deltaY < 0 ? stageZoom * scaleBy : stageZoom / scaleBy;
                zoomViewport(Math.max(0.15, Math.min(3, newZoom)));
            } else {
                const clamped = clampViewport(stagePos.x - e.evt.deltaX, stagePos.y - e.evt.deltaY, stageZoom);
                setViewport({
                    x: clamped.x,
                    y: clamped.y,
                    zoom: stageZoom
                });
            }
        },
        [stageZoom, stagePos, zoomViewport, setViewport, clampViewport],
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
                selectLink(null);
                setCtxMenu(null);
                setTimePicker(null);
                setEditingNodeId(null);
                setEditingSubNodeId(null);
                setCtxMenu(null);
                setSelectedBadge(null);
                setLinkCtxMenu(null);
                if (linkingSourceId) {
                    setLinkingSource(null);
                    setLinkingMousePos(null);
                }
            }
        },
        [clearSelection, selectLink, linkingSourceId, setLinkingSource],
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

    // Follow a link — push current state to history, then pan to target node
    const handleFollowLink = useCallback(
        (linkId: string) => {
            const link = links[linkId];
            if (!link) return;

            // Navigate to the target node
            const targetId = link.targetId;
            const targetInfo = layout.get(targetId);
            const targetDims = nodeDims.get(targetId);
            if (!targetInfo || !targetDims) return;

            // Push current viewport + selection to history before navigating
            setNavHistory((prev) => [
                ...prev,
                { viewport: { x: stagePos.x, y: stagePos.y, zoom: stageZoom }, selectedNodeIds: [...selectedNodeIds] },
            ]);

            const tPos = getEffectivePos(targetId);
            const tCX = tPos.x + NODE_WIDTH / 2;
            const tCY = tPos.y + targetDims.totalHeight / 2;

            // Centre the target node in the viewport
            const newX = dimensions.width / 2 - tCX * stageZoom;
            const newY = dimensions.height / 2 - tCY * stageZoom;

            setViewport({ x: newX, y: newY, zoom: stageZoom });
            setSelection([targetId]);
        },
        [links, layout, nodeDims, getEffectivePos, dimensions, stageZoom, stagePos, selectedNodeIds, setViewport, setSelection],
    );

    // Trace back — pop and restore the previous viewport + selection
    const handleTraceBack = useCallback(() => {
        if (navHistory.length === 0) return;
        const prev = navHistory[navHistory.length - 1];
        setNavHistory((h) => h.slice(0, -1));
        setViewport(prev.viewport);
        if (prev.selectedNodeIds.length > 0) {
            setSelection(prev.selectedNodeIds);
        } else {
            clearSelection();
        }
    }, [navHistory, setViewport, setSelection, clearSelection]);

    // Alt+← keyboard shortcut for trace-back
    useEffect(() => {
        const handleTraceBackKey = (e: KeyboardEvent) => {
            if (e.altKey && e.key === 'ArrowLeft') {
                const tag = (e.target as HTMLElement)?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
                e.preventDefault();
                handleTraceBack();
            }
        };
        window.addEventListener('keydown', handleTraceBackKey);
        return () => window.removeEventListener('keydown', handleTraceBackKey);
    }, [handleTraceBack]);

    // Center node triggered by RootNodesPanel
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            const nodeId = detail.nodeId;
            const targetInfo = layout.get(nodeId);
            const targetDims = nodeDims.get(nodeId);
            if (!targetInfo || !targetDims) return;

            const tPos = getEffectivePos(nodeId);
            const tCX = tPos.x + NODE_WIDTH / 2;
            const tCY = tPos.y + targetDims.totalHeight / 2;

            const newX = dimensions.width / 2 - tCX * stageZoom;
            const newY = dimensions.height / 2 - tCY * stageZoom;

            setViewport({ x: newX, y: newY, zoom: stageZoom });
            setSelection([nodeId]);
        };
        window.addEventListener('mindmap:center-node', handler);
        return () => window.removeEventListener('mindmap:center-node', handler);
    }, [layout, nodeDims, getEffectivePos, dimensions, stageZoom, setViewport, setSelection]);

    // Build edges using effective positions with adaptive anchor selection
    const edgeLines = useMemo(() => {
        const lines: { key: string; points: number[]; color: string; width: number; targetId: string; entrySide: 'left' | 'right' | 'top' | 'bottom' }[] = [];

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

            const sW = sourceInfo.width;
            const sH = sourceInfo.height;
            const tW = targetInfo.width;
            const tH = targetInfo.height;
            const tTitleH = targetDims?.titleHeight ?? MIN_TITLE_HEIGHT;

            // Source center Y (may be overridden for promoted edges)
            let sCenterY = sPos.y + sH / 2;
            let isPromoted = false;

            if (targetNode?.parentSubNodeId && sourceNode && sourceDims) {
                const snDim = sourceDims.subNodeDims.find(d => d.id === targetNode.parentSubNodeId);
                if (snDim) {
                    sCenterY = sPos.y + sourceDims.titleHeight + snDim.yOffset + snDim.height / 2;
                    isPromoted = true;
                }
            }

            // Target center
            const tCenterX = tPos.x + tW / 2;
            const tCenterY = tPos.y + tH / 2;
            // Source center X is always the horizontal middle
            const sCenterX = sPos.x + sW / 2;

            const dx = tCenterX - sCenterX;
            const dy = tCenterY - sCenterY;

            // Choose exit side for source
            // 'horizontal' style forces left/right exits regardless of dy
            let sx: number, sy: number, sDirX: number, sDirY: number;
            const forceHorizontal = connectorAnchor === 'horizontal';
            if (forceHorizontal || Math.abs(dx) >= Math.abs(dy)) {
                // Primarily horizontal
                if (dx >= 0) {
                    // Child is to the right → exit right
                    sx = sPos.x + sW; sy = sCenterY; sDirX = 1; sDirY = 0;
                } else {
                    // Child is to the left → exit left
                    sx = sPos.x; sy = sCenterY; sDirX = -1; sDirY = 0;
                }
            } else {
                // Primarily vertical
                if (dy >= 0) {
                    // Child is below → exit bottom
                    sx = sCenterX; sy = sPos.y + sH; sDirX = 0; sDirY = 1;
                } else {
                    // Child is above → exit top
                    sx = sCenterX; sy = sPos.y; sDirX = 0; sDirY = -1;
                }
            }

            // Choose entry side for target
            let tx: number, ty: number, tDirX: number, tDirY: number;
            let entrySide: 'left' | 'right' | 'top' | 'bottom';
            if (forceHorizontal || Math.abs(dx) >= Math.abs(dy)) {
                if (dx >= 0) {
                    // Child is to the right → enter left
                    tx = tPos.x; ty = tPos.y + tTitleH / 2; tDirX = -1; tDirY = 0;
                    entrySide = 'left';
                } else {
                    // Child is to the left → enter right
                    tx = tPos.x + tW; ty = tPos.y + tTitleH / 2; tDirX = 1; tDirY = 0;
                    entrySide = 'right';
                }
            } else {
                if (dy >= 0) {
                    // Child is below → enter top
                    tx = tPos.x + tW / 2; ty = tPos.y; tDirX = 0; tDirY = -1;
                    entrySide = 'top';
                } else {
                    // Child is above → enter bottom
                    tx = tPos.x + tW / 2; ty = tPos.y + tH; tDirX = 0; tDirY = 1;
                    entrySide = 'bottom';
                }
            }

            let points: number[];
            if (lineStyle === 'bezier') {
                // Bezier mode
                const dist = Math.sqrt(dx * dx + dy * dy);
                const cp = Math.max(30, Math.min(80, dist * 0.3));
                const cp1x = sx + sDirX * cp;
                const cp1y = sy + sDirY * cp;
                const cp2x = tx + tDirX * cp;
                const cp2y = ty + tDirY * cp;
                points = [sx, sy, cp1x, cp1y, cp2x, cp2y, tx, ty];
            } else if (lineStyle === 'straight') {
                // Straight line
                points = [sx, sy, tx, ty];
            } else {
                // Orthogonal mode: step at horizontal midpoint
                const midX = (sx + tx) / 2;
                points = [sx, sy, midX, sy, midX, ty, tx, ty];
            }

            lines.push({
                key: edge.id,
                points,
                color: isPromoted ? COLORS.edgePromoted : COLORS.edgeColor,
                width: isPromoted ? 2 : 1.5,
                targetId: edge.targetId,
                entrySide,
            });
        }

        return lines;
    }, [edges, layout, nodes, nodeDims, getEffectivePos, COLORS]);

    // ── Associative link lines ────────────────────────────────────────────
    const linkLines = useMemo(() => {
        const result: { id: string; points: number[]; midX: number; midY: number }[] = [];
        for (const link of Object.values(links)) {
            const sInfo = layout.get(link.sourceId);
            const tInfo = layout.get(link.targetId);
            if (!sInfo || !tInfo) continue;

            const sDims = nodeDims.get(link.sourceId);
            const tDims = nodeDims.get(link.targetId);
            if (!sDims || !tDims) continue;

            const sPos = getEffectivePos(link.sourceId);
            const tPos = getEffectivePos(link.targetId);

            const sW = sInfo.width, sH = sDims.totalHeight;
            const tW = tInfo.width, tH = tDims.totalHeight;

            const sCenterX = sPos.x + sW / 2, sCenterY = sPos.y + sH / 2;
            const tCenterX = tPos.x + tW / 2, tCenterY = tPos.y + tH / 2;
            const dx = tCenterX - sCenterX, dy = tCenterY - sCenterY;

            const fh = connectorAnchor === 'horizontal';
            let sx: number, sy: number, sDirX: number, sDirY: number;
            if (fh || Math.abs(dx) >= Math.abs(dy)) {
                if (dx >= 0) { sx = sPos.x + sW; sy = sCenterY; sDirX = 1; sDirY = 0; }
                else { sx = sPos.x; sy = sCenterY; sDirX = -1; sDirY = 0; }
            } else {
                if (dy >= 0) { sx = sCenterX; sy = sPos.y + sH; sDirX = 0; sDirY = 1; }
                else { sx = sCenterX; sy = sPos.y; sDirX = 0; sDirY = -1; }
            }

            let tx: number, ty: number, tDirX: number, tDirY: number;
            if (fh || Math.abs(dx) >= Math.abs(dy)) {
                if (dx >= 0) { tx = tPos.x; ty = tCenterY; tDirX = -1; tDirY = 0; }
                else { tx = tPos.x + tW; ty = tCenterY; tDirX = 1; tDirY = 0; }
            } else {
                if (dy >= 0) { tx = tCenterX; ty = tPos.y; tDirX = 0; tDirY = -1; }
                else { tx = tCenterX; ty = tPos.y + tH; tDirX = 0; tDirY = 1; }
            }

            let points: number[];
            let midX: number, midY: number;

            if (lineStyle === 'bezier') {
                const dist = Math.sqrt(dx * dx + dy * dy);
                const cp = Math.max(30, Math.min(80, dist * 0.3));
                const cp1x = sx + sDirX * cp, cp1y = sy + sDirY * cp;
                const cp2x = tx + tDirX * cp, cp2y = ty + tDirY * cp;
                points = [sx, sy, cp1x, cp1y, cp2x, cp2y, tx, ty];
                midX = 0.125 * sx + 0.375 * cp1x + 0.375 * cp2x + 0.125 * tx;
                midY = 0.125 * sy + 0.375 * cp1y + 0.375 * cp2y + 0.125 * ty;
            } else if (lineStyle === 'straight') {
                points = [sx, sy, tx, ty];
                midX = (sx + tx) / 2; midY = (sy + ty) / 2;
            } else {
                // Orthogonal: step via horizontal midpoint
                const mx = (sx + tx) / 2;
                points = [sx, sy, mx, sy, mx, ty, tx, ty];
                midX = mx; midY = (sy + ty) / 2;
            }

            result.push({
                id: link.id,
                points,
                midX,
                midY,
            });
        }
        return result;
    }, [links, layout, nodeDims, getEffectivePos]);

    // ── File drag-and-drop handlers ────────────────────────────────────────
    const handleFileDragOver = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'copy';

            // Hit-test against nodes to find drop target
            const stage = stageRef.current;
            if (!stage) return;
            const rect = (e.target as HTMLElement).closest('.canvas-container')?.getBoundingClientRect();
            if (!rect) return;
            const mouseX = (e.clientX - rect.left - stagePos.x) / stageZoom;
            const mouseY = (e.clientY - rect.top - stagePos.y) / stageZoom;

            let hitNodeId: string | null = null;
            for (const [nodeId, info] of layout) {
                const pos = (() => {
                    const manual = manualPositions[nodeId];
                    if (manual) return { x: manual.x + offsetX, y: manual.y + offsetY };
                    return { x: info.x + offsetX, y: info.y + offsetY };
                })();
                const dims = nodeDims.get(nodeId);
                if (!dims) continue;
                if (
                    mouseX >= pos.x && mouseX <= pos.x + NODE_WIDTH &&
                    mouseY >= pos.y && mouseY <= pos.y + dims.totalHeight
                ) {
                    hitNodeId = nodeId;
                    break;
                }
            }
            setDropTargetNodeId(hitNodeId);
        },
        [stageRef, stagePos, stageZoom, layout, manualPositions, nodeDims, offsetX, offsetY],
    );

    const handleFileDragLeave = useCallback(() => {
        setDropTargetNodeId(null);
    }, []);

    const handleFileDrop = useCallback(
        (e: React.DragEvent<HTMLDivElement>) => {
            if (!e.dataTransfer.types.includes('Files')) return;
            e.preventDefault();
            e.stopPropagation();
            setDropTargetNodeId(null);
            if (!e.dataTransfer.files.length) return;

            // Hit-test to find target node
            const stage = stageRef.current;
            if (!stage) return;
            const rect = (e.target as HTMLElement).closest('.canvas-container')?.getBoundingClientRect();
            if (!rect) return;
            const mouseX = (e.clientX - rect.left - stagePos.x) / stageZoom;
            const mouseY = (e.clientY - rect.top - stagePos.y) / stageZoom;

            let hitNodeId: string | null = null;
            for (const [nodeId, info] of layout) {
                const pos = (() => {
                    const manual = manualPositions[nodeId];
                    if (manual) return { x: manual.x + offsetX, y: manual.y + offsetY };
                    return { x: info.x + offsetX, y: info.y + offsetY };
                })();
                const dims = nodeDims.get(nodeId);
                if (!dims) continue;
                if (
                    mouseX >= pos.x && mouseX <= pos.x + NODE_WIDTH &&
                    mouseY >= pos.y && mouseY <= pos.y + dims.totalHeight
                ) {
                    hitNodeId = nodeId;
                    break;
                }
            }

            if (!hitNodeId) return;

            pushUndo();
            for (const file of Array.from(e.dataTransfer.files)) {
                const filePath = window.electronAPI?.getFilePath(file) || '';
                addAttachmentSubNode(hitNodeId, filePath, file.name);
            }
        },
        [stageRef, stagePos, stageZoom, layout, manualPositions, nodeDims, offsetX, offsetY, pushUndo, addAttachmentSubNode],
    );

    return (
        <div
            ref={containerRef}
            className="canvas-container"
            style={{ background: COLORS.canvasBg }}
            onDragEnter={handleFileDragOver}
            onDragOver={handleFileDragOver}
            onDragLeave={handleFileDragLeave}
            onDrop={handleFileDrop}
        >
            <Stage
                ref={stageRef}
                width={dimensions.width}
                height={dimensions.height}
                draggable={!linkingSourceId}
                dragBoundFunc={(pos) => clampViewport(pos.x, pos.y, stageZoom)}
                scaleX={stageZoom}
                scaleY={stageZoom}
                x={stagePos.x}
                y={stagePos.y}
                onWheel={handleWheel}
                onDragEnd={handleStageDragEnd}
                onClick={handleStageClick}
                onTap={handleStageClick}
                onContextMenu={(e) => e.evt.preventDefault()}
                onMouseMove={(e) => {
                    if (linkingSourceId) {
                        const stage = e.target.getStage();
                        if (!stage) return;
                        const pos = stage.getPointerPosition();
                        if (pos) {
                            setLinkingMousePos({
                                x: (pos.x - stagePos.x) / stageZoom,
                                y: (pos.y - stagePos.y) / stageZoom,
                            });
                        }
                    }
                }}
            >
                <Layer>
                    {/* Edges */}
                    {edgeLines.map((line) => (
                        <Line
                            key={line.key}
                            points={line.points}
                            stroke={line.color}
                            strokeWidth={line.width}
                            {...(lineStyle === 'bezier'
                                ? { bezier: true, lineCap: 'round' as const }
                                : lineStyle === 'straight'
                                ? { lineCap: 'round' as const }
                                : { cornerRadius: 8, lineJoin: 'round' as const }
                            )}
                            opacity={0.7}
                        />
                    ))}

                    {/* Associative link lines */}
                    {linkLines.map((ll) => {
                        const isSelected = selectedLinkId === ll.id;
                        const isHovered = hoveredLinkId === ll.id;
                        return (
                            <Group key={`link-${ll.id}`}>
                                {/* Invisible thick hit area */}
                                <Line
                                    points={ll.points}
                                    stroke="transparent"
                                    strokeWidth={12}
                                    {...(lineStyle === 'bezier'
                                        ? { bezier: true, lineCap: 'round' as const }
                                        : lineStyle === 'straight'
                                        ? { lineCap: 'round' as const }
                                        : { cornerRadius: 8, lineJoin: 'round' as const }
                                    )}
                                    onClick={(e) => {
                                        e.cancelBubble = true;
                                        selectLink(ll.id);
                                    }}
                                    onContextMenu={(e) => {
                                        e.evt.preventDefault();
                                        e.cancelBubble = true;
                                        selectLink(ll.id);
                                        setLinkCtxMenu({
                                            x: e.evt.clientX,
                                            y: e.evt.clientY,
                                            linkId: ll.id,
                                        });
                                    }}
                                    onMouseEnter={(e) => {
                                        setHoveredLinkId(ll.id);
                                        const c = e.target.getStage()?.container();
                                        if (c) c.style.cursor = 'pointer';
                                    }}
                                    onMouseLeave={(e) => {
                                        setHoveredLinkId(null);
                                        const c = e.target.getStage()?.container();
                                        if (c) c.style.cursor = 'default';
                                    }}
                                />
                                {/* Visible dotted line */}
                                <Line
                                    points={ll.points}
                                    stroke={isSelected ? COLORS.edgePromoted : COLORS.edgeColor}
                                    strokeWidth={isSelected ? 2 : 1.5}
                                    dash={[6, 4]}
                                    {...(lineStyle === 'bezier'
                                        ? { bezier: true, lineCap: 'round' as const }
                                        : lineStyle === 'straight'
                                        ? { lineCap: 'round' as const }
                                        : { cornerRadius: 8, lineJoin: 'round' as const }
                                    )}
                                    opacity={isHovered ? 1 : 0.6}
                                    listening={false}
                                />
                            </Group>
                        );
                    })}

                    {/* Link mode preview line */}
                    {linkingSourceId && linkingMousePos && (() => {
                        const sInfo = layout.get(linkingSourceId);
                        const sDims = nodeDims.get(linkingSourceId);
                        if (!sInfo || !sDims) return null;
                        const sPos = getEffectivePos(linkingSourceId);
                        const sCX = sPos.x + sInfo.width / 2;
                        const sCY = sPos.y + sDims.totalHeight / 2;
                        return (
                            <Line
                                points={[sCX, sCY, linkingMousePos.x, linkingMousePos.y]}
                                stroke={COLORS.edgePromoted}
                                strokeWidth={1.5}
                                dash={[6, 4]}
                                cornerRadius={8}
                                opacity={0.5}
                                listening={false}
                            />
                        );
                    })()}

                    {/* Nodes */}
                    {Array.from(layout.entries()).map(([nodeId, info]) => {
                        const node = nodes[nodeId];
                        if (!node) return null;
                        const isSelected = selectedNodeIds.includes(nodeId);
                        const isRoot = rootIds.includes(nodeId);

                        let isPromotedCompleted = false;
                        if (node.parentId && node.parentSubNodeId) {
                            const parentNode = nodes[node.parentId];
                            if (parentNode) {
                                const sourceSubNode = findSubNodeById(parentNode.subNodes, node.parentSubNodeId);
                                if (sourceSubNode && sourceSubNode.type === 'checklist' && sourceSubNode.checked) {
                                    isPromotedCompleted = true;
                                }
                            }
                        }

                        const ePos = getEffectivePos(nodeId);
                        const x = ePos.x;
                        const y = ePos.y;
                        const dims = nodeDims.get(nodeId)!;
                        const titleH = dims.titleHeight;
                        const h = dims.totalHeight;
                        const isSubNodesHidden = !!node.subNodesCollapsed && node.subNodes.length > 0;
                        const flatSubs = isSubNodesHidden ? [] : flattenSubNodes(node.subNodes);

                        return (
                            <Group
                                key={nodeId}
                                x={x}
                                y={y}
                                draggable={!linkingSourceId}
                                onClick={(e) => {
                                    if (linkingSourceId && linkingSourceId !== nodeId) {
                                        e.cancelBubble = true;
                                        pushUndo();
                                        addLink(linkingSourceId, nodeId);
                                        setLinkingSource(null);
                                        setLinkingMousePos(null);
                                    }
                                }}
                                onMouseUp={(e) => {
                                    if (linkingSourceId && linkingSourceId !== nodeId) {
                                        e.cancelBubble = true;
                                        pushUndo();
                                        addLink(linkingSourceId, nodeId);
                                        setLinkingSource(null);
                                        setLinkingMousePos(null);
                                    }
                                }}
                                onDragStart={(e) => {
                                    e.cancelBubble = true;
                                    // Shift+drag = start linking
                                    if (e.evt.shiftKey) {
                                        e.target.stopDrag();
                                        pushUndo();
                                        setLinkingSource(nodeId);
                                        return;
                                    }
                                    pushUndo();
                                }}
                                onDragMove={(e) => {
                                    e.cancelBubble = true;
                                    setDraggingPos({
                                        nodeId,
                                        x: e.target.x(),
                                        y: e.target.y(),
                                    });

                                    const stage = e.target.getStage();
                                    if (!stage) return;
                                    const pointerPos = stage.getPointerPosition();
                                    if (!pointerPos) return;
                                    
                                    const mouseX = (pointerPos.x - stagePos.x) / stageZoom;
                                    const mouseY = (pointerPos.y - stagePos.y) / stageZoom;

                                    let hitNodeId: string | null = null;
                                    for (const [otherNodeId, info] of layout) {
                                        if (otherNodeId === nodeId) continue;
                                        
                                        // Check bounds
                                        const pos = (() => {
                                            const manual = manualPositions[otherNodeId];
                                            if (manual) return { x: manual.x + offsetX, y: manual.y + offsetY };
                                            return { x: info.x + offsetX, y: info.y + offsetY };
                                        })();
                                        const dims = nodeDims.get(otherNodeId);
                                        if (!dims) continue;

                                        if (
                                            mouseX >= pos.x && mouseX <= pos.x + NODE_WIDTH &&
                                            mouseY >= pos.y && mouseY <= pos.y + dims.totalHeight
                                        ) {
                                            hitNodeId = otherNodeId;
                                            break;
                                        }
                                    }
                                    setDropTargetNodeId(hitNodeId);
                                }}
                                onDragEnd={(e) => {
                                    e.cancelBubble = true;
                                    setDraggingPos(null);

                                    if (dropTargetNodeId && dropTargetNodeId !== nodes[nodeId]?.parentId) {
                                        let isDescendant = false;
                                        let curr: MindMapNode | undefined = nodes[dropTargetNodeId];
                                        while (curr) {
                                            if (curr.id === nodeId) {
                                                isDescendant = true; break;
                                            }
                                            curr = curr.parentId ? nodes[curr.parentId] : undefined;
                                        }

                                        if (!isDescendant && nodeId !== dropTargetNodeId) {
                                            reparentNode(nodeId, dropTargetNodeId);
                                            // Ensure node snaps to its new layer level hierarchy
                                            useMindMapStore.setState((s) => {
                                                delete s.manualPositions[nodeId];
                                            });
                                            
                                            if (rootIds.includes(dropTargetNodeId)) {
                                                const parentX = (layout.get(dropTargetNodeId)?.x ?? 0) + offsetX;
                                                const dropCenterX = e.target.x() + NODE_WIDTH / 2;
                                                const parentCenterX = parentX + NODE_WIDTH / 2;
                                                setNodeSide(nodeId, dropCenterX < parentCenterX ? 'left' : 'right');
                                            }
                                        }
                                    } else {
                                        // --- Side detection & Sibling reorder detection ---
                                        const draggedNode = nodes[nodeId];
                                        const isRootNode = rootIds.includes(nodeId);
                                        
                                        // 1. Detect side if child of root
                                        let currentSide: 'left' | 'right' = draggedNode?.side || 'right';
                                        if (!isRootNode && draggedNode?.parentId) {
                                            const parent = nodes[draggedNode.parentId];
                                            if (parent && !parent.parentId) { // Parent is root
                                                const parentX = (layout.get(parent.id)?.x ?? 0) + offsetX;
                                                const dropCenterX = e.target.x() + NODE_WIDTH / 2;
                                                const parentCenterX = parentX + NODE_WIDTH / 2;
                                                const newSide = dropCenterX < parentCenterX ? 'left' : 'right';
                                                if (newSide !== currentSide) {
                                                    setNodeSide(nodeId, newSide);
                                                    currentSide = newSide;
                                                }
                                            }
                                        }

                                        const siblings = isRootNode
                                            ? rootIds
                                            : (draggedNode?.parentId ? nodes[draggedNode.parentId]?.children : null);

                                        if (siblings && siblings.length > 1) {
                                            // 2. Filter siblings to only those on the SAME SIDE
                                            const filteredSiblings = isRootNode 
                                                ? siblings 
                                                : siblings.filter(s => {
                                                    if (s === nodeId) return true; // keep self for index calc
                                                    return (nodes[s]?.side || 'right') === currentSide;
                                                });

                                            if (filteredSiblings.length > 1) {
                                                const dropY = e.target.y();

                                                // Build array of { id, midY } for each sibling on the same side except the dragged one
                                                const siblingMids: { id: string; midY: number }[] = [];
                                                for (const sibId of filteredSiblings) {
                                                    if (sibId === nodeId) continue;
                                                    const sibPos = (() => {
                                                        const m = manualPositions[sibId];
                                                        if (m) return { x: m.x + offsetX, y: m.y + offsetY };
                                                        const li = layout.get(sibId);
                                                        if (li) return { x: li.x + offsetX, y: li.y + offsetY };
                                                        return { x: offsetX, y: offsetY };
                                                    })();
                                                    const sibDim = nodeDims.get(sibId);
                                                    const h = sibDim ? sibDim.totalHeight : 40;
                                                    siblingMids.push({ id: sibId, midY: sibPos.y + h / 2 });
                                                }

                                                // Sort by midY
                                                siblingMids.sort((a, b) => a.midY - b.midY);

                                                // Find insertion index in the filtered list
                                                let targetIdxInFiltered = siblingMids.length;
                                                for (let i = 0; i < siblingMids.length; i++) {
                                                    if (dropY < siblingMids[i].midY) {
                                                        targetIdxInFiltered = i;
                                                        break;
                                                    }
                                                }

                                                const origIdxInFiltered = filteredSiblings.indexOf(nodeId);
                                                
                                                if (targetIdxInFiltered !== origIdxInFiltered) {
                                                    // Map the index in the filtered list back to the global sibling index
                                                    // Actually, moveChildToIndex handles indices within the side list in my new store logic!
                                                    // Wait, let's check moveChildToIndex in store.ts.
                                                    // I updated reorderChildNode, but moveChildToIndex is a direct splice.
                                                    // I should use moveChildToIndex with the global index?
                                                    // No, if moveChildToIndex is side-naive, it will break my interleaved ordering.
                                                    // Let's re-verify moveChildToIndex in store.ts.
                                                    
                                                    // I need to find the global index that corresponds to "targetIdxInFiltered"
                                                    // in the original 'siblings' array.
                                                    // If inserting at targetIdxInFiltered, we are basically saying 
                                                    // "before the sibling that is currently at targetIdxInFiltered".
                                                    
                                                    let globalTargetIdx: number;
                                                    if (targetIdxInFiltered < siblingMids.length) {
                                                        const targetSibId = siblingMids[targetIdxInFiltered].id;
                                                        globalTargetIdx = siblings.indexOf(targetSibId);
                                                    } else {
                                                        globalTargetIdx = siblings.length;
                                                    }

                                                    const origGlobalIdx = siblings.indexOf(nodeId);
                                                    
                                                    if (globalTargetIdx !== origGlobalIdx) {
                                                        pushUndo();
                                                        if (isRootNode) {
                                                            moveRootToIndex(nodeId, globalTargetIdx);
                                                        } else {
                                                            moveChildToIndex(nodeId, globalTargetIdx);
                                                        }
                                                        
                                                        const state = useMindMapStore.getState();
                                                        if (state.manualPositions[nodeId]) {
                                                            useMindMapStore.setState((s) => {
                                                                delete s.manualPositions[nodeId];
                                                            });
                                                        }
                                                        setDropTargetNodeId(null);
                                                        return; // Done
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    setDropTargetNodeId(null);
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
                                {/* Drop target highlight */}
                                {dropTargetNodeId === nodeId && (
                                    <Rect
                                        x={-4}
                                        y={-4}
                                        width={NODE_WIDTH + 8}
                                        height={h + 8}
                                        cornerRadius={BORDER_RADIUS + 3}
                                        stroke={COLORS.edgePromoted}
                                        strokeWidth={2.5}
                                        fill={`${COLORS.edgePromoted}10`}
                                        dash={[6, 4]}
                                        listening={false}
                                    />
                                )}

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
                                    stroke={darkenHex(node.style.fillColor)}
                                    strokeWidth={1}
                                    cornerRadius={BORDER_RADIUS}
                                />

                                {/* Title section */}
                                <Rect
                                    width={NODE_WIDTH}
                                    height={titleH}
                                    fill={node.style.fillColor}
                                    cornerRadius={
                                        (flatSubs.length > 0 || isSubNodesHidden)
                                            ? [BORDER_RADIUS, BORDER_RADIUS, 0, 0]
                                            : BORDER_RADIUS
                                    }
                                />
                                {(flatSubs.length > 0 || isSubNodesHidden) && (
                                    <Line
                                        points={[0, titleH, NODE_WIDTH, titleH]}
                                        stroke={darkenHex(node.style.fillColor)}
                                        strokeWidth={1}
                                        listening={false}
                                    />
                                )}
                                <Text
                                    x={ROW_PADDING_X}
                                    y={0}
                                    width={NODE_WIDTH - ROW_PADDING_X * 2 - (node.children.length > 0 ? 20 : 0)}
                                    height={titleH}
                                    text={wrapTextWithNewlines(node.text, NODE_WIDTH - ROW_PADDING_X * 2 - (node.children.length > 0 ? 20 : 0), isRoot ? 15 : 13, isRoot ? 'bold' : '600')}
                                    fontSize={isRoot ? 15 : 13}
                                    fontFamily="Inter, sans-serif"
                                    fontStyle={isRoot ? 'bold' : '600'}
                                    fill={isPromotedCompleted ? COLORS.rowTextChecked : getContrastColor(node.style.fillColor)}
                                    textDecoration={isPromotedCompleted ? 'line-through' : ''}
                                    verticalAlign="middle"
                                    wrap="none"
                                    lineHeight={LINE_HEIGHT_FACTOR}
                                    onClick={(e) => {
                                        if (linkingSourceId && linkingSourceId !== nodeId) return;
                                        e.cancelBubble = true;
                                        setSelection([nodeId]);
                                    }}
                                    onMouseUp={(e) => {
                                        if (linkingSourceId && linkingSourceId !== nodeId) return;
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
                                    const isAttachment = sn.type === 'attachment';
                                    const isSubNodeSelected = selectedSubNodeId === sn.id && selectedSubNodeParentId === nodeId;

                                    return (
                                        <Group
                                            key={sn.id}
                                            y={rowY}
                                            onClick={(e) => {
                                                if (linkingSourceId && linkingSourceId !== nodeId) return;
                                                e.cancelBubble = true;
                                                setSelectedSubNode(nodeId, sn.id);
                                                setSelection([nodeId]);
                                            }}
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
                                            {/* Selection highlight */}
                                            {isSubNodeSelected && (
                                                <Rect
                                                    x={0}
                                                    y={0}
                                                    width={NODE_WIDTH}
                                                    height={rowH}
                                                    fill={`${COLORS.selectedRing}18`}
                                                    stroke={COLORS.selectedRing}
                                                    strokeWidth={1.5}
                                                    cornerRadius={isLastRow ? [0, 0, BORDER_RADIUS, BORDER_RADIUS] : 0}
                                                    listening={false}
                                                />
                                            )}

                                            <Rect
                                                width={NODE_WIDTH}
                                                height={rowH}
                                                fill={COLORS.rowBg}
                                                cornerRadius={isLastRow ? [0, 0, BORDER_RADIUS, BORDER_RADIUS] : 0}
                                                opacity={isSubNodeSelected ? 0 : 1}
                                            />
                                            {!isLastRow && (
                                                <Line
                                                    points={[ROW_PADDING_X, rowH, NODE_WIDTH - ROW_PADDING_X, rowH]}
                                                    stroke="#000"
                                                    opacity={0.06}
                                                    strokeWidth={1}
                                                    listening={false}
                                                />
                                            )}

                                            {isAttachment ? (
                                                /* ── Attachment icon (paperclip) ── */
                                                <Path
                                                    x={ROW_PADDING_X + indent}
                                                    y={ROW_PAD_Y + (12 * LINE_HEIGHT_FACTOR) / 2 - 7}
                                                    data="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"
                                                    fill={COLORS.edgePromoted}
                                                    scaleX={0.58}
                                                    scaleY={0.58}
                                                    listening={false}
                                                />
                                            ) : (
                                                /* ── Checkbox ── */
                                                <>
                                                    <Rect
                                                        x={ROW_PADDING_X + indent}
                                                        y={ROW_PAD_Y + (12 * LINE_HEIGHT_FACTOR) / 2 - 7}
                                                        width={14}
                                                        height={14}
                                                        cornerRadius={3}
                                                        stroke={sn.checked ? COLORS.checkboxChecked : COLORS.checkboxBorder}
                                                        strokeWidth={1.5}
                                                        fill={sn.checked ? COLORS.checkboxChecked : 'transparent'}
                                                        onClick={(e) => {
                                                            if (linkingSourceId && linkingSourceId !== nodeId) return;
                                                            e.cancelBubble = true;
                                                            pushUndo();
                                                            toggleSubNodeChecked(nodeId, sn.id);
                                                        }}
                                                        onMouseUp={(e) => {
                                                            if (linkingSourceId && linkingSourceId !== nodeId) return;
                                                        }}
                                                    />
                                                    {sn.checked && (
                                                        <Text
                                                            x={ROW_PADDING_X + indent}
                                                            y={ROW_PAD_Y + (12 * LINE_HEIGHT_FACTOR) / 2 - 7}
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
                                                </>
                                            )}

                                            {/* SubNode text container */}
                                            <Group
                                                x={ROW_PADDING_X + indent + 20}
                                                y={ROW_PAD_Y}
                                            >
                                                <Text
                                                    width={NODE_WIDTH - ROW_PADDING_X * 2 - indent - 20 - (sn.childNodeId ? 16 : 0)}
                                                    height={rowH - ROW_PAD_Y * 2}
                                                    text={wrapTextWithNewlines(sn.text, NODE_WIDTH - ROW_PADDING_X * 2 - indent - 20 - (sn.childNodeId ? 16 : 0), 12)}
                                                    fontSize={12}
                                                    fontFamily="Inter, sans-serif"
                                                    fill={isAttachment ? COLORS.edgePromoted : (sn.checked ? COLORS.rowTextChecked : COLORS.rowText)}
                                                    textDecoration={isAttachment ? 'underline' : (sn.checked ? 'line-through' : '')}
                                                    verticalAlign="top"
                                                    wrap="none"
                                                    lineHeight={LINE_HEIGHT_FACTOR}
                                                    onClick={(e) => {
                                                        if (e.evt.button === 0 && isAttachment && sn.filePath) {
                                                            window.electronAPI?.openPath(sn.filePath);
                                                        }
                                                        // Bubbles to Group for selection
                                                    }}
                                                    onDblClick={(e) => {
                                                        if (isAttachment) return;
                                                        e.cancelBubble = true;
                                                        setEditingNodeId(nodeId);
                                                        setEditingSubNodeId(sn.id);
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        if (isAttachment) {
                                                            const c = e.target.getStage()?.container();
                                                            if (c) c.style.cursor = 'pointer';
                                                        }
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        if (isAttachment) {
                                                            const c = e.target.getStage()?.container();
                                                            if (c) c.style.cursor = 'default';
                                                        }
                                                    }}
                                                />
                                            </Group>

                                            {/* Time badge */}
                                            {!isAttachment && (() => {
                                                const badge = formatTimeLabel(sn.startTime, sn.endTime, sn.timeGranularity);
                                                if (!badge) return null;
                                                const badgeColors = badge.type === 'planned' ? COLORS.timeBadgePlanned
                                                    : badge.type === 'deadline' ? COLORS.timeBadgeDeadline
                                                        : COLORS.timeBadgeSlot;
                                                // Calculate text height to position badge below it
                                                const textAvailW = NODE_WIDTH - ROW_PADDING_X * 2 - indent - 20 - (sn.childNodeId ? 16 : 0);
                                                const textLines = measureTextLines(sn.text, textAvailW, 12);
                                                const textH = textLines * 12 * LINE_HEIGHT_FACTOR;
                                                const badgeY = ROW_PAD_Y + textH + 4;
                                                const badgeX = ROW_PADDING_X + indent + 20;

                                                // Measure badge text width
                                                _measureCtx.font = '10px Inter, sans-serif';
                                                const badgeTextW = _measureCtx.measureText(badge.text).width;
                                                const badgeW = badgeTextW + 10;

                                                return (
                                                    <Group
                                                        x={badgeX}
                                                        y={badgeY}
                                                        onClick={(e) => {
                                                            e.cancelBubble = true;
                                                            setSelectedBadge({ nodeId, subNodeId: sn.id });
                                                            // Clear other selections
                                                            setSelection([]);
                                                            selectLink(null);
                                                            setSelectedSubNode(null, null);
                                                        }}
                                                        onDblClick={(e) => {
                                                            e.cancelBubble = true;
                                                            setTimePicker({
                                                                x: e.evt.clientX,
                                                                y: e.evt.clientY,
                                                                nodeId,
                                                                subNodeId: sn.id,
                                                            });
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
                                                        <Rect
                                                            width={badgeW}
                                                            height={14}
                                                            cornerRadius={7}
                                                            fill={badgeColors.bg}
                                                            stroke={selectedBadge?.subNodeId === sn.id ? COLORS.selectedRing : undefined}
                                                            strokeWidth={selectedBadge?.subNodeId === sn.id ? 2 : 0}
                                                        />
                                                        <Text
                                                            width={badgeW}
                                                            height={14}
                                                            text={badge.text}
                                                            fontSize={10}
                                                            fontFamily="Inter, sans-serif"
                                                            fill={badgeColors.text}
                                                            align="center"
                                                            verticalAlign="middle"
                                                        />
                                                    </Group>
                                                );
                                            })()}

                                            {!isAttachment && sn.childNodeId && (
                                                <Group
                                                    x={NODE_WIDTH - ROW_PADDING_X - 8}
                                                    y={ROW_PAD_Y + (12 * LINE_HEIGHT_FACTOR) / 2 - 6}
                                                    onClick={(e) => {
                                                        if (linkingSourceId && linkingSourceId !== nodeId) return;
                                                        e.cancelBubble = true;
                                                        toggleSubNodeCollapse(nodeId, sn.id);
                                                    }}
                                                    onMouseUp={(e) => {
                                                        if (linkingSourceId && linkingSourceId !== nodeId) return;
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
                                                    <Rect width={12} height={12} fill="transparent" />
                                                    <Text
                                                        width={12}
                                                        height={12}
                                                        text={sn.collapsed ? '▸' : '▾'}
                                                        fontSize={11}
                                                        fill={COLORS.edgePromoted}
                                                        align="center"
                                                        verticalAlign="middle"
                                                    />
                                                </Group>
                                            )}

                                            {/* Promote button (checklist only) */}
                                            {!isAttachment && !sn.childNodeId && (
                                                <Group
                                                    x={NODE_WIDTH - 8}
                                                    y={ROW_PAD_Y + (12 * LINE_HEIGHT_FACTOR) / 2 - 8}
                                                    onClick={(e) => {
                                                        if (linkingSourceId && linkingSourceId !== nodeId) return;
                                                        e.cancelBubble = true;
                                                        pushUndo();
                                                        promoteSubNode(nodeId, sn.id);
                                                    }}
                                                    onMouseUp={(e) => {
                                                        if (linkingSourceId && linkingSourceId !== nodeId) return;
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

                                {/* Connector dot on edge entry side */}
                                {!rootIds.includes(nodeId) && (() => {
                                    const edgeLine = edgeLines.find(l => l.targetId === nodeId);
                                    const side = edgeLine?.entrySide ?? 'left';
                                    let cx = 0, cy = titleH / 2;
                                    if (side === 'right') { cx = NODE_WIDTH; cy = titleH / 2; }
                                    else if (side === 'top') { cx = NODE_WIDTH / 2; cy = 0; }
                                    else if (side === 'bottom') { cx = NODE_WIDTH / 2; cy = h; }
                                    return (
                                        <Circle
                                            x={cx}
                                            y={cy}
                                            radius={CONNECTOR_RADIUS}
                                            fill={COLORS.connectorBg}
                                            stroke={COLORS.nodeBorder}
                                            strokeWidth={1}
                                            listening={false}
                                        />
                                    );
                                })()}

                                {/* Collapsed sub-items indicator */}
                                {isSubNodesHidden && (
                                    <Group
                                        y={titleH}
                                        onClick={(e) => {
                                            e.cancelBubble = true;
                                            useMindMapStore.getState().toggleSubNodesCollapsed(nodeId);
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
                                        <Rect
                                            width={NODE_WIDTH}
                                            height={20}
                                            fill="transparent"
                                        />
                                        <Text
                                            x={ROW_PADDING_X}
                                            y={0}
                                            width={NODE_WIDTH - ROW_PADDING_X * 2}
                                            height={20}
                                            text={`▸ ${node.subNodes.length} item${node.subNodes.length !== 1 ? 's' : ''}`}
                                            fontSize={10}
                                            fontFamily="Inter, sans-serif"
                                            fontStyle="normal"
                                            fill={COLORS.rowTextChecked}
                                            verticalAlign="middle"
                                        />
                                    </Group>
                                )}

                                {/* Add item button */}
                                <Group
                                    y={h - 2}
                                    onClick={(e) => {
                                        if (linkingSourceId && linkingSourceId !== nodeId) return;
                                        e.cancelBubble = true;
                                        pushUndo();
                                        const newSubId = addSubNode(nodeId);
                                        window.dispatchEvent(new CustomEvent('mindmap:edit-subnode', { detail: { nodeId, subNodeId: newSubId } }));
                                    }}
                                    onMouseUp={(e) => {
                                        if (linkingSourceId && linkingSourceId !== nodeId) return;
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
                    <InlineEditor
                        key={`edit-${editingNodeId}`}
                        defaultValue={nodes[editingNodeId]?.text || ''}
                        onCommit={handleEditCommit}
                        onCancel={() => setEditingNodeId(null)}
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
                            color: getContrastColor(nodes[editingNodeId]?.style.fillColor ?? '#6c63ff'),
                            background: nodes[editingNodeId]?.style.fillColor ?? '#6c63ff',
                            border: `2px solid ${COLORS.selectedRing}`,
                            borderRadius: `${BORDER_RADIUS * stageZoom}px`,
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
                    <InlineEditor
                        key={`edit-sn-${editingSubNodeId}`}
                        defaultValue={sn?.text || ''}
                        onCommit={(val) => handleSubNodeEditCommit(editingNodeId, editingSubNodeId, val)}
                        onCancel={() => { setEditingSubNodeId(null); setEditingNodeId(null); }}
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
                            fontWeight: 400,
                            lineHeight: `${LINE_HEIGHT_FACTOR}`,
                            color: theme === 'dark' ? '#e8e8ed' : '#333340',
                            background: theme === 'dark' ? '#1e1e2a' : '#ffffff',
                            border: `2px solid ${COLORS.selectedRing}`,
                            borderRadius: `4px`,
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
                    onSetTime={(nodeId, subNodeId) => {
                        setCtxMenu(null);
                        setTimePicker({
                            x: ctxMenu.x,
                            y: ctxMenu.y,
                            nodeId,
                            subNodeId,
                        });
                    }}
                />
            )}

            {/* Link context menu */}
            {linkCtxMenu && (
                <>
                    <div className="ctx-backdrop" onClick={() => setLinkCtxMenu(null)} />
                    <div className="ctx-menu" style={{ left: linkCtxMenu.x, top: linkCtxMenu.y }}>
                        <button
                            className="ctx-item"
                            onClick={() => {
                                handleFollowLink(linkCtxMenu.linkId);
                                setLinkCtxMenu(null);
                            }}
                        >
                            → Follow Link
                        </button>
                        {navHistory.length > 0 && (
                            <button
                                className="ctx-item"
                                onClick={() => {
                                    handleTraceBack();
                                    setLinkCtxMenu(null);
                                }}
                            >
                                ← Trace Back
                            </button>
                        )}
                        <button
                            className="ctx-item ctx-danger"
                            onClick={() => {
                                pushUndo();
                                deleteLink(linkCtxMenu.linkId);
                                setLinkCtxMenu(null);
                            }}
                        >
                            ✕ Delete Link
                        </button>
                    </div>
                </>
            )}

            {/* Floating trace-back button — visible when nav history is non-empty */}
            {navHistory.length > 0 && (
                <button
                    className="nav-back-btn"
                    title="Trace Back (Alt + ←)"
                    onClick={handleTraceBack}
                >
                    ← Back
                </button>
            )}

            {/* Date Time Picker */}
            {timePicker && (
                <DateTimePicker
                    x={timePicker.x}
                    y={timePicker.y}
                    nodeId={timePicker.nodeId}
                    subNodeId={timePicker.subNodeId}
                    onClose={() => setTimePicker(null)}
                />
            )}
        </div>
    );
}
