import { useState, useCallback, useRef } from 'react';
import { MindMapCanvas } from './components/canvas/MindMapCanvas';
import { FloatingBar } from './components/toolbar/FloatingBar';
import { ShortcutsModal } from './components/shortcuts/ShortcutsModal';
import { useKeyboard } from './hooks/useKeyboard';
import { useMenuActions } from './hooks/useMenuActions';
import { useMindMapStore } from './store/store';

export function App() {
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const stageRef = useRef<any>(null);
    const viewport = useMindMapStore((s) => s.viewport);

    useKeyboard();

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            return next;
        });
    }, []);

    useMenuActions(
        stageRef,
        toggleTheme,
        () => setShowShortcuts(true),
    );

    return (
        <div className="app-layout">
            <MindMapCanvas stageRef={stageRef} theme={theme} />
            <FloatingBar
                zoom={viewport.zoom}
                onToggleTheme={toggleTheme}
                theme={theme}
            />
            {showShortcuts && (
                <ShortcutsModal onClose={() => setShowShortcuts(false)} />
            )}
        </div>
    );
}
