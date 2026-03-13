import { useState, useMemo, useCallback } from 'react';
import { useMindMapStore } from '../../store/store';
import {
    getWeekStart,
    getWeekDates,
    toDateKey,
    extractCalendarEvents,
    layoutOverlaps,
    formatDayHeader,
    formatWeekRange,
    formatHour,
} from '../../utils/calendarUtils';
import type { CalendarEvent, LayoutEvent } from '../../utils/calendarUtils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 52; // px per hour row
const ALL_DAY_EVENT_HEIGHT = 24;
const ALL_DAY_ROW_MIN = 32;

export function CalendarPanel() {
    const nodes = useMindMapStore((s) => s.nodes);
    const toggleCalendar = useMindMapStore((s) => s.toggleCalendar);

    const [weekOffset, setWeekOffset] = useState(0);

    const today = useMemo(() => new Date(), []);

    const weekStart = useMemo(() => {
        const ws = getWeekStart(today);
        ws.setDate(ws.getDate() + weekOffset * 7);
        return ws;
    }, [today, weekOffset]);

    const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
    const weekLabel = useMemo(() => formatWeekRange(weekDates), [weekDates]);
    const todayKey = useMemo(() => toDateKey(today), [today]);

    const events = useMemo(
        () => extractCalendarEvents(nodes, weekStart),
        [nodes, weekStart],
    );

    // Group events by day
    const eventsByDay = useMemo(() => {
        const map: Record<string, { allDay: CalendarEvent[]; timed: LayoutEvent[] }> = {};
        for (const d of weekDates) {
            const key = toDateKey(d);
            const dayEvents = events.filter((e) => e.date === key);
            const allDay = dayEvents.filter((e) => e.type === 'all-day');
            const timed = layoutOverlaps(dayEvents);
            map[key] = { allDay, timed };
        }
        return map;
    }, [events, weekDates]);

    const prevWeek = useCallback(() => setWeekOffset((w) => w - 1), []);
    const nextWeek = useCallback(() => setWeekOffset((w) => w + 1), []);
    const goToday = useCallback(() => setWeekOffset(0), []);

    // Compute max all-day event count for consistent row height
    const maxAllDay = useMemo(() => {
        let max = 0;
        for (const d of weekDates) {
            const key = toDateKey(d);
            const count = eventsByDay[key]?.allDay.length ?? 0;
            if (count > max) max = count;
        }
        return max;
    }, [eventsByDay, weekDates]);

    const allDayRowHeight = Math.max(
        ALL_DAY_ROW_MIN,
        maxAllDay * (ALL_DAY_EVENT_HEIGHT + 2) + 8,
    );

    return (
        <div className="cal-panel">
            {/* ── Header ── */}
            <div className="cal-header">
                <button className="cal-nav-btn" onClick={prevWeek} title="Previous week">◀</button>
                <span className="cal-week-label">{weekLabel}</span>
                <button className="cal-nav-btn" onClick={nextWeek} title="Next week">▶</button>
                <button className="cal-today-btn" onClick={goToday}>Today</button>
                <button className="cal-close-btn" onClick={toggleCalendar} title="Close calendar">✕</button>
            </div>

            {/* ── Grid ── */}
            <div className="cal-body">
                {/* Day headers */}
                <div className="cal-day-headers">
                    <div className="cal-gutter" />
                    {weekDates.map((d, i) => {
                        const { dayName, dateNum } = formatDayHeader(d, i);
                        const isToday = toDateKey(d) === todayKey;
                        return (
                            <div
                                key={i}
                                className={`cal-day-header ${isToday ? 'cal-today' : ''}`}
                            >
                                <span className="cal-day-name">{dayName}</span>
                                <span className={`cal-day-num ${isToday ? 'cal-today-num' : ''}`}>
                                    {dateNum}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* All-day row */}
                <div className="cal-all-day-row" style={{ height: allDayRowHeight }}>
                    <div className="cal-gutter cal-all-day-label">All day</div>
                    {weekDates.map((d, i) => {
                        const key = toDateKey(d);
                        const items = eventsByDay[key]?.allDay ?? [];
                        return (
                            <div key={i} className="cal-all-day-cell">
                                {items.map((ev) => (
                                    <div
                                        key={ev.id}
                                        className="cal-all-day-chip"
                                        style={{ backgroundColor: ev.fillColor }}
                                        title={`${ev.nodeText} › ${ev.text}`}
                                    >
                                        {ev.text}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>

                {/* Time grid */}
                <div className="cal-time-scroll">
                    <div className="cal-time-grid" style={{ height: HOURS.length * HOUR_HEIGHT }}>
                        {/* Hour labels */}
                        <div className="cal-hour-labels">
                            {HOURS.map((h) => (
                                <div
                                    key={h}
                                    className="cal-hour-label"
                                    style={{ height: HOUR_HEIGHT }}
                                >
                                    {formatHour(h)}
                                </div>
                            ))}
                        </div>

                        {/* Day columns */}
                        {weekDates.map((d, dayIdx) => {
                            const key = toDateKey(d);
                            const timed = eventsByDay[key]?.timed ?? [];
                            const isToday = key === todayKey;
                            return (
                                <div
                                    key={dayIdx}
                                    className={`cal-day-col ${isToday ? 'cal-today-col' : ''}`}
                                >
                                    {/* Hour grid lines */}
                                    {HOURS.map((h) => (
                                        <div
                                            key={h}
                                            className="cal-hour-cell"
                                            style={{ height: HOUR_HEIGHT }}
                                        />
                                    ))}

                                    {/* Event blocks */}
                                    {timed.map((ev) => (
                                        <EventBlock
                                            key={ev.id}
                                            event={ev}
                                            hourHeight={HOUR_HEIGHT}
                                        />
                                    ))}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ── Event Block ───────────────────────────────────────────────────────────

function EventBlock({
    event,
    hourHeight,
}: {
    event: LayoutEvent;
    hourHeight: number;
}) {
    const top = event.startHour * hourHeight;
    const height = Math.max((event.endHour - event.startHour) * hourHeight, 18);
    const widthPct = 100 / event.totalColumns;
    const leftPct = event.column * widthPct;

    const startH = Math.floor(event.startHour);
    const startM = Math.round((event.startHour - startH) * 60);
    const endH = Math.floor(event.endHour);
    const endM = Math.round((event.endHour - endH) * 60);
    const timeStr = `${String(startH).padStart(2, '0')}:${String(startM).padStart(2, '0')} – ${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

    return (
        <div
            className="cal-event"
            style={{
                top,
                height,
                left: `calc(${leftPct}% + 1px)`,
                width: `calc(${widthPct}% - 2px)`,
                backgroundColor: event.fillColor,
            }}
            title={`${event.nodeText} › ${event.text}\n${timeStr}`}
        >
            <div className="cal-event-time">{timeStr}</div>
            <div className="cal-event-title">{event.text}</div>
            <div className="cal-event-node">{event.nodeText}</div>
        </div>
    );
}
