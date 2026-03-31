import React, { useState, useRef } from 'react';
import { useMindMapStore } from '../../store/store';
import { IconX, IconEye, IconEyeOff } from '../common/SimpleIcon';

export function RootNodesPanel() {
    const rootNodesPanelOpen = useMindMapStore((s) => s.rootNodesPanelOpen);
    const togglePanel = useMindMapStore((s) => s.toggleRootNodesPanel);
    const nodes = useMindMapStore((s) => s.nodes);
    const rootIds = useMindMapStore((s) => s.rootIds);
    const hiddenRootIds = useMindMapStore((s) => s.hiddenRootIds);
    const toggleRootVisibility = useMindMapStore((s) => s.toggleRootVisibility);

    const [pos, setPos] = useState({ x: 20, y: 80 });
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });

    if (!rootNodesPanelOpen) return null;

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        isDragging.current = true;
        dragStart.current = {
            x: e.clientX - pos.x,
            y: e.clientY - pos.y
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging.current) return;
        setPos({
            x: e.clientX - dragStart.current.x,
            y: Math.max(0, e.clientY - dragStart.current.y)
        });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        isDragging.current = false;
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    };

    return (
        <div 
            className="root-nodes-panel"
            style={{ left: pos.x, top: pos.y }}
        >
            <div 
                className="root-nodes-header"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
            >
                <div className="root-nodes-drag-handle">
                    <span className="root-nodes-title">Root Nodes</span>
                </div>
                <button 
                    className="root-nodes-close-btn" 
                    onClick={togglePanel} 
                    title="Close Panel"
                >
                    <IconX size={14} />
                </button>
            </div>
            <div className="root-nodes-content">
                {rootIds.length === 0 && (
                    <div className="root-nodes-empty">No root nodes</div>
                )}
                {rootIds.map(id => {
                    const node = nodes[id];
                    if (!node) return null;
                    const isHidden = hiddenRootIds.includes(id);
                    return (
                        <div key={id} className={`root-nodes-item-container ${isHidden ? 'is-hidden' : ''}`}>
                            <button 
                                className="root-nodes-item"
                                title={node.text}
                                onClick={() => {
                                    window.dispatchEvent(new CustomEvent('mindmap:center-node', { detail: { nodeId: id } }));
                                }}
                            >
                                <span 
                                    className="root-nodes-item-color" 
                                    style={{ backgroundColor: node.style.fillColor }}
                                />
                                <span className="root-nodes-item-text">{node.text || 'Untitled Node'}</span>
                            </button>
                            <button
                                className="root-nodes-toggle-vis"
                                title={isHidden ? "Show Root Tree" : "Hide Root Tree"}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    toggleRootVisibility(id);
                                }}
                            >
                                {isHidden ? <IconEyeOff size={14} /> : <IconEye size={14} />}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
