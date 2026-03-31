import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useMindMapStore } from '../../store/store';
import { computeLayout } from '../../layout/layout';

interface MiniMapProps {
    theme: 'light' | 'dark';
}

const MINI_MAP_SIZE = 220;
const NODE_WIDTH = 200; // Same as MindMapCanvas
const MIN_TITLE_HEIGHT = 44;
const MIN_ROW_HEIGHT = 32;

export function MiniMap({ theme }: MiniMapProps) {
    const nodes = useMindMapStore((s) => s.nodes);
    const rootIds = useMindMapStore((s) => s.rootIds);
    const hiddenRootIds = useMindMapStore((s) => s.hiddenRootIds);
    const viewport = useMindMapStore((s) => s.viewport);
    const setViewport = useMindMapStore((s) => s.setViewport);
    const manualPositions = useMindMapStore((s) => s.manualPositions);

    const containerRef = useRef<HTMLDivElement>(null);
    const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });

    // We need to know the actual canvas size to draw the viewport rectangle
    useEffect(() => {
        const updateSize = () => {
            const canvasContainer = document.querySelector('.split-pane-canvas');
            if (canvasContainer) {
                setCanvasSize({
                    width: canvasContainer.clientWidth,
                    height: canvasContainer.clientHeight
                });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        // Also observe split-pane changes
        const observer = new ResizeObserver(updateSize);
        const canvasContainer = document.querySelector('.split-pane-canvas');
        if (canvasContainer) observer.observe(canvasContainer);

        return () => {
            window.removeEventListener('resize', updateSize);
            observer.disconnect();
        };
    }, []);

    const visibleRootIds = useMemo(() => rootIds.filter(id => !hiddenRootIds.includes(id)), [rootIds, hiddenRootIds]);

    const layout = useMemo(() => {
        const heights = new Map<string, number>();
        for (const [id, node] of Object.entries(nodes)) {
            heights.set(id, MIN_TITLE_HEIGHT + (node.subNodesCollapsed ? 0 : node.subNodes.length * MIN_ROW_HEIGHT));
        }

        return computeLayout(nodes, visibleRootIds, {
            nodeWidth: NODE_WIDTH,
            nodeBaseHeight: MIN_TITLE_HEIGHT,
            subNodeRowHeight: MIN_ROW_HEIGHT,
            horizontalSpacing: NODE_WIDTH + 80,
            verticalSpacing: 24,
        }, heights, manualPositions);
    }, [nodes, visibleRootIds, manualPositions]);

    const offsets = useMemo(() => {
        let fMinY = Infinity, fMaxY = -Infinity;
        for (const [, info] of layout) {
            fMinY = Math.min(fMinY, info.y);
            fMaxY = Math.max(fMaxY, info.y + info.height);
        }
        if (fMinY === Infinity) return { offsetX: 0, offsetY: 0 };
        
        const offsetX = canvasSize.width * 0.12;
        const fHeight = fMaxY - fMinY;
        const offsetY = canvasSize.height / 2 - fMinY - fHeight / 2;
        return { offsetX, offsetY };
    }, [layout, canvasSize]);

    // Bounds of the entire map in world coordinates
    const bounds = useMemo(() => {
        if (layout.size === 0) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        for (const [id, info] of layout) {
            const x = info.x + offsets.offsetX;
            const y = info.y + offsets.offsetY;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x + NODE_WIDTH);
            maxY = Math.max(maxY, y + info.height);
        }

        // Add some padding
        const pad = 400;
        return { 
            minX: minX - pad, 
            minY: minY - pad, 
            maxX: maxX + pad, 
            maxY: maxY + pad 
        };
    }, [layout, offsets]);

    const worldWidth = bounds.maxX - bounds.minX;
    const worldHeight = bounds.maxY - bounds.minY;
    const scale = Math.min(MINI_MAP_SIZE / worldWidth, MINI_MAP_SIZE / worldHeight);
    
    const miniMapWidth = worldWidth * scale;
    const miniMapHeight = worldHeight * scale;

    const toMiniX = (x: number) => (x - bounds.minX) * scale;
    const toMiniY = (y: number) => (y - bounds.minY) * scale;
    const toWorldX = (mx: number) => (mx / scale) + bounds.minX;
    const toWorldY = (my: number) => (my / scale) + bounds.minY;

    // Viewport rectangle in world coords
    const viewWorldX = -viewport.x / viewport.zoom;
    const viewWorldY = -viewport.y / viewport.zoom;
    const viewWorldW = canvasSize.width / viewport.zoom;
    const viewWorldH = canvasSize.height / viewport.zoom;

    const handleInteraction = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = (e as React.MouseEvent).clientX;
            clientY = (e as React.MouseEvent).clientY;
        }

        const mx = clientX - rect.left;
        const my = clientY - rect.top;

        // Target center in world coords
        const targetWorldCX = toWorldX(mx);
        const targetWorldCY = toWorldY(my);

        const newX = canvasSize.width / 2 - targetWorldCX * viewport.zoom;
        const newY = canvasSize.height / 2 - targetWorldCY * viewport.zoom;

        setViewport({ x: newX, y: newY, zoom: viewport.zoom });
    }, [viewport, canvasSize, setViewport, bounds, scale, toWorldX, toWorldY]);

    const [isDragging, setIsDragging] = useState(false);

    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        handleInteraction(e);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (isDragging) handleInteraction(e);
    };

    const onMouseUp = () => setIsDragging(false);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('mousemove', onMouseMove as any);
            return () => {
                window.removeEventListener('mouseup', onMouseUp);
                window.removeEventListener('mousemove', onMouseMove as any);
            };
        }
    }, [isDragging, onMouseMove]);

    if (rootIds.length === 0) return null;

    return (
        <div 
            className="mini-map" 
            ref={containerRef}
            style={{ 
                width: miniMapWidth, 
                height: miniMapHeight,
            }}
            onMouseDown={onMouseDown}
        >
            <svg width={miniMapWidth} height={miniMapHeight} style={{ pointerEvents: 'none' }}>
                {/* Render nodes */}
                {Array.from(layout.entries()).map(([id, info]) => {
                    const node = nodes[id];
                    const fillColor = node?.style.fillColor || (theme === 'dark' ? '#7c75ff' : '#6c63ff');
                    
                    // Simplified darken function
                    const strokeColor = (() => {
                        const amount = 0.2;
                        const hex = fillColor.replace('#', '');
                        const n = parseInt(hex, 16);
                        const r = Math.max(0, Math.round(((n >> 16) & 0xff) * (1 - amount)));
                        const g = Math.max(0, Math.round(((n >> 8) & 0xff) * (1 - amount)));
                        const b = Math.max(0, Math.round((n & 0xff) * (1 - amount)));
                        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
                    })();

                    return (
                        <rect
                            key={id}
                            x={toMiniX(info.x + offsets.offsetX)}
                            y={toMiniY(info.y + offsets.offsetY)}
                            width={NODE_WIDTH * scale}
                            height={info.height * scale}
                            fill={fillColor}
                            stroke={strokeColor}
                            strokeWidth={0.5}
                            opacity={0.7}
                            rx={2}
                        />
                    );
                })}

                {/* Viewport rectangle */}
                <rect
                    className="mini-map-viewport"
                    x={toMiniX(viewWorldX)}
                    y={toMiniY(viewWorldY)}
                    width={viewWorldW * scale}
                    height={viewWorldH * scale}
                    rx={2}
                />
            </svg>
        </div>
    );
}
