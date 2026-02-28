import { useState, useEffect, useRef } from 'react';
import { useMindMapStore } from '../../store/store';
import type { SubNode } from '../../types';

interface DateTimePickerProps {
    x: number;
    y: number;
    nodeId: string;
    subNodeId: string;
    onClose: () => void;
}

function findSn(subs: SubNode[], id: string): SubNode | null {
    for (const sn of subs) {
        if (sn.id === id) return sn;
        const found = findSn(sn.subNodes, id);
        if (found) return found;
    }
    return null;
}

export function DateTimePicker({ x, y, nodeId, subNodeId, onClose }: DateTimePickerProps) {
    const nodes = useMindMapStore((s) => s.nodes);
    const updateSubNodeTimes = useMindMapStore((s) => s.updateSubNodeTimes);
    const pushUndo = useMindMapStore((s) => s.pushUndo);

    const node = nodes[nodeId];
    const sn = node ? findSn(node.subNodes, subNodeId) : null;

    const existingStart = sn?.startTime || '';
    const existingEnd = sn?.endTime || '';
    const existingGranularity = sn?.timeGranularity || 'date';

    const extractTime = (val: string) => val.includes('T') ? val.split('T')[1] : '09:00';

    const [granularity, setGranularity] = useState<'date' | 'datetime'>(existingGranularity);
    const [startValue, setStartValue] = useState(existingStart);
    const [endValue, setEndValue] = useState(existingEnd);

    // Keep track of the last known time so toggling back to datetime restores it
    const [lastStartTime, setLastStartTime] = useState(extractTime(existingStart));
    const [lastEndTime, setLastEndTime] = useState(extractTime(existingEnd));

    const startInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Focus the start input on mount
        setTimeout(() => startInputRef.current?.focus(), 50);
    }, []);

    // Track time edits
    useEffect(() => {
        if (granularity === 'datetime') {
            if (startValue.includes('T')) setLastStartTime(startValue.split('T')[1]);
            if (endValue.includes('T')) setLastEndTime(endValue.split('T')[1]);
        }
    }, [startValue, endValue, granularity]);

    // When granularity changes, convert existing values
    useEffect(() => {
        setStartValue(prev => {
            if (!prev) return prev;
            if (granularity === 'date' && prev.includes('T')) return prev.split('T')[0];
            if (granularity === 'datetime' && !prev.includes('T')) return `${prev}T${lastStartTime}`;
            return prev;
        });
        setEndValue(prev => {
            if (!prev) return prev;
            if (granularity === 'date' && prev.includes('T')) return prev.split('T')[0];
            if (granularity === 'datetime' && !prev.includes('T')) return `${prev}T${lastEndTime}`;
            return prev;
        });
    }, [granularity]);

    const handleSave = () => {
        if (startValue || endValue) {
            pushUndo();
            // Send null instead of empty string if a field is cleared
            updateSubNodeTimes(
                nodeId,
                subNodeId,
                startValue || null,
                endValue || null,
                granularity
            );
        }
        onClose();
    };

    // Position: clamp to viewport
    const pickerW = 320; // wider to accommodate side-by-side inputs
    const pickerH = 140;
    const clampedX = Math.min(x, window.innerWidth - pickerW - 16);
    const clampedY = Math.min(y, window.innerHeight - pickerH - 16);

    const inputType = granularity === 'date' ? 'date' : 'datetime-local';

    return (
        <>
            <div className="dtp-backdrop" onClick={onClose} />
            <div className="dtp-popover" style={{ left: clampedX, top: clampedY, width: pickerW }}>
                <div className="dtp-header">
                    📅 Set Time
                </div>

                {/* Granularity toggle */}
                <div className="dtp-toggle" style={{ justifyContent: 'center', marginBottom: 12 }}>
                    <button
                        className={`dtp-toggle-btn ${granularity === 'date' ? 'dtp-toggle-active' : ''}`}
                        onClick={() => setGranularity('date')}
                    >
                        Date
                    </button>
                    <button
                        className={`dtp-toggle-btn ${granularity === 'datetime' ? 'dtp-toggle-active' : ''}`}
                        onClick={() => setGranularity('datetime')}
                    >
                        Date & Time
                    </button>
                </div>

                {/* Side-by-side inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px', marginBottom: '12px' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#8888a0', fontWeight: 600 }}>Start</label>
                        <input
                            ref={startInputRef}
                            className="dtp-input"
                            type={inputType}
                            value={startValue}
                            onChange={(e) => setStartValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') onClose();
                                e.stopPropagation();
                            }}
                            style={{ margin: 0, width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', color: '#8888a0', fontWeight: 600 }}>End</label>
                        <input
                            className="dtp-input"
                            type={inputType}
                            value={endValue}
                            onChange={(e) => setEndValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSave();
                                if (e.key === 'Escape') onClose();
                                e.stopPropagation();
                            }}
                            style={{ margin: 0, width: '100%', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                <div className="dtp-actions" style={{ padding: '0 12px 12px' }}>
                    <button className="dtp-btn dtp-btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="dtp-btn dtp-btn-save" onClick={handleSave} disabled={!startValue && !endValue}>Save</button>
                </div>
            </div>
        </>
    );
}
