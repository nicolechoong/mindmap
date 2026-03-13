import type { MindMapNode, SubNode } from '../types';

// ── Calendar Event Type ───────────────────────────────────────────────────

export interface CalendarEvent {
    id: string;           // subNode.id
    nodeId: string;       // parent MindMapNode id
    nodeText: string;     // parent node label (for context)
    text: string;         // subNode text
    type: 'all-day' | 'timed';
    date: string;         // YYYY-MM-DD
    startHour: number;    // 0–24 (decimal, e.g. 14.5 = 2:30 PM)
    endHour: number;      // 0–24
    fillColor: string;    // from parent node's style
}

// ── Week helpers ──────────────────────────────────────────────────────────

/** Get the Monday of the week containing `date`. */
export function getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay(); // 0=Sun … 6=Sat
    const diff = day === 0 ? -6 : 1 - day; // shift to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/** Returns 7 Date objects Mon–Sun starting from a Monday. */
export function getWeekDates(monday: Date): Date[] {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
}

/** Format a Date as YYYY-MM-DD. */
export function toDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

/** Parse an ISO string to a decimal hour (e.g. "2026-03-10T14:30" → 14.5). */
function isoToDecimalHour(iso: string): number {
    const parts = iso.split('T');
    if (parts.length < 2) return 0;
    const [hh, mm] = parts[1].split(':').map(Number);
    return hh + (mm || 0) / 60;
}

/** Parse an ISO string's date portion as YYYY-MM-DD. */
function isoToDateKey(iso: string): string {
    return iso.substring(0, 10); // works for both "2026-03-10" and "2026-03-10T14:00"
}

// ── Event Extraction ──────────────────────────────────────────────────────

const DEFAULT_BLOCK_HOURS = 1;

/** Recursively walk SubNode trees and collect CalendarEvents. */
function walkSubNodes(
    subNodes: SubNode[],
    nodeId: string,
    nodeText: string,
    fillColor: string,
    weekStartKey: string,
    weekEndKey: string,
    out: CalendarEvent[],
): void {
    for (const sn of subNodes) {
        const hasStart = !!sn.startTime;
        const hasEnd = !!sn.endTime;

        if (hasStart || hasEnd) {
            const granularity = sn.timeGranularity || 'date';

            if (granularity === 'date') {
                // Date-only → all-day events
                const dateKey = hasStart ? isoToDateKey(sn.startTime!) : isoToDateKey(sn.endTime!);
                if (dateKey >= weekStartKey && dateKey <= weekEndKey) {
                    out.push({
                        id: sn.id,
                        nodeId,
                        nodeText,
                        text: sn.text,
                        type: 'all-day',
                        date: dateKey,
                        startHour: 0,
                        endHour: 0,
                        fillColor,
                    });
                }
            } else {
                // datetime → timed block
                let startH: number;
                let endH: number;
                let dateKey: string;

                if (hasStart && hasEnd) {
                    dateKey = isoToDateKey(sn.startTime!);
                    startH = isoToDecimalHour(sn.startTime!);
                    endH = isoToDecimalHour(sn.endTime!);
                    // Ensure minimum visibility
                    if (endH <= startH) endH = startH + 0.5;
                } else if (hasStart) {
                    dateKey = isoToDateKey(sn.startTime!);
                    startH = isoToDecimalHour(sn.startTime!);
                    endH = startH + DEFAULT_BLOCK_HOURS;
                } else {
                    // Only end time
                    dateKey = isoToDateKey(sn.endTime!);
                    endH = isoToDecimalHour(sn.endTime!);
                    startH = Math.max(0, endH - DEFAULT_BLOCK_HOURS);
                }

                if (dateKey >= weekStartKey && dateKey <= weekEndKey) {
                    out.push({
                        id: sn.id,
                        nodeId,
                        nodeText,
                        text: sn.text,
                        type: 'timed',
                        date: dateKey,
                        startHour: startH,
                        endHour: Math.min(endH, 24),
                        fillColor,
                    });
                }
            }
        }

        // Recurse into nested subnodes
        if (sn.subNodes.length > 0) {
            walkSubNodes(sn.subNodes, nodeId, nodeText, fillColor, weekStartKey, weekEndKey, out);
        }
    }
}

/**
 * Extracts all CalendarEvents for the given week from the mind map nodes.
 * `weekStart` should be a Monday at 00:00.
 */
export function extractCalendarEvents(
    nodes: Record<string, MindMapNode>,
    weekStart: Date,
): CalendarEvent[] {
    const weekDates = getWeekDates(weekStart);
    const weekStartKey = toDateKey(weekDates[0]);
    const weekEndKey = toDateKey(weekDates[6]);

    const events: CalendarEvent[] = [];

    for (const node of Object.values(nodes)) {
        walkSubNodes(
            node.subNodes,
            node.id,
            node.text,
            node.style.fillColor,
            weekStartKey,
            weekEndKey,
            events,
        );
    }

    return events;
}

// ── Overlap Layout ────────────────────────────────────────────────────────

export interface LayoutEvent extends CalendarEvent {
    column: number;    // 0-based column index within its overlap group
    totalColumns: number; // total columns in its group
}

/** Compute side-by-side layout for overlapping timed events in one day. */
export function layoutOverlaps(events: CalendarEvent[]): LayoutEvent[] {
    const timed = events
        .filter((e) => e.type === 'timed')
        .sort((a, b) => a.startHour - b.startHour || a.endHour - b.endHour);

    if (timed.length === 0) return [];

    // Greedy column assignment
    const result: LayoutEvent[] = [];
    const columns: number[] = []; // end hours for each column

    for (const ev of timed) {
        let placed = false;
        for (let c = 0; c < columns.length; c++) {
            if (ev.startHour >= columns[c]) {
                columns[c] = ev.endHour;
                result.push({ ...ev, column: c, totalColumns: 0 });
                placed = true;
                break;
            }
        }
        if (!placed) {
            result.push({ ...ev, column: columns.length, totalColumns: 0 });
            columns.push(ev.endHour);
        }
    }

    // Set totalColumns – find connected overlap groups
    // Simple approach: for each event, find all events that overlap with it
    // transitively and assign the max column + 1 as totalColumns.
    for (let i = 0; i < result.length; i++) {
        const group = findOverlapGroup(result, i);
        const maxCol = Math.max(...group.map((idx) => result[idx].column)) + 1;
        for (const idx of group) {
            result[idx].totalColumns = Math.max(result[idx].totalColumns, maxCol);
        }
    }

    return result;
}

function findOverlapGroup(events: LayoutEvent[], startIdx: number): number[] {
    const visited = new Set<number>();
    const queue = [startIdx];
    while (queue.length > 0) {
        const idx = queue.pop()!;
        if (visited.has(idx)) continue;
        visited.add(idx);
        const ev = events[idx];
        for (let j = 0; j < events.length; j++) {
            if (!visited.has(j)) {
                const other = events[j];
                // Two events overlap if one starts before the other ends
                if (ev.startHour < other.endHour && other.startHour < ev.endHour) {
                    queue.push(j);
                }
            }
        }
    }
    return Array.from(visited);
}

// ── Formatting helpers ────────────────────────────────────────────────────

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function formatDayHeader(d: Date, idx: number): { dayName: string; dateNum: number } {
    return { dayName: DAY_NAMES[idx], dateNum: d.getDate() };
}

export function formatWeekRange(weekDates: Date[]): string {
    const s = weekDates[0];
    const e = weekDates[6];
    if (s.getMonth() === e.getMonth()) {
        return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`;
}

export function formatHour(h: number): string {
    const hh = String(h).padStart(2, '0');
    return `${hh}:00`;
}
