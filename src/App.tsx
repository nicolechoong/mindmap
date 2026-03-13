import { useState, useCallback, useRef } from 'react';
import { MindMapCanvas } from './components/canvas/MindMapCanvas';
import { FloatingBar } from './components/toolbar/FloatingBar';
import { ShortcutsModal } from './components/shortcuts/ShortcutsModal';
import { CalendarPanel } from './components/calendar/CalendarPanel';
import { FilesHome } from './components/home/FilesHome';
import { useKeyboard } from './hooks/useKeyboard';
import { useMenuActions } from './hooks/useMenuActions';
import { useMindMapStore } from './store/store';

export function App() {
    const [screen, setScreen] = useState<'home' | 'editor'>('home');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);
    const stageRef = useRef<any>(null);
    const viewport = useMindMapStore((s) => s.viewport);
    const calendarOpen = useMindMapStore((s) => s.calendarOpen);
    const calendarSplit = useMindMapStore((s) => s.calendarSplit);
    const docTitle = useMindMapStore((s) => s.title);
    const store = useMindMapStore();

    useKeyboard();

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const next = prev === 'light' ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', next);
            return next;
        });
    }, []);

    const goHome = useCallback(() => {
        setScreen('home');
    }, []);

    const goEditor = useCallback(() => {
        setScreen('editor');
    }, []);

    useMenuActions(
        stageRef,
        toggleTheme,
        () => setShowShortcuts(true),
        goHome,
        goEditor,
    );

    const handleOpenFile = useCallback(async (filePath: string) => {
        try {
            const result = await window.electronAPI.libraryRead(filePath);
            const doc = JSON.parse(result.content);
            store.loadDocument(doc);
            setCurrentFilePath(filePath);
            setScreen('editor');
        } catch (err) {
            console.error('Failed to open file:', err);
        }
    }, [store]);

    const handleNewFile = useCallback(async (title: string) => {
        try {
            const result = await window.electronAPI.libraryCreate(title);
            const readResult = await window.electronAPI.libraryRead(result.filePath);
            const doc = JSON.parse(readResult.content);
            store.loadDocument(doc);
            store.addRootNode();
            setCurrentFilePath(result.filePath);
            setScreen('editor');
        } catch (err) {
            console.error('Failed to create file:', err);
        }
    }, [store]);

    const handleBack = useCallback(async () => {
        try {
            const doc = store.toDocument();
            await window.electronAPI.fileSave(JSON.stringify(doc, null, 2));
        } catch { /* ignore */ }
        setCurrentFilePath(null);
        setEditingName(false);
        setScreen('home');
    }, [store]);

    const handleNameClick = useCallback(() => {
        setNameValue(docTitle);
        setEditingName(true);
        setTimeout(() => nameInputRef.current?.select(), 0);
    }, [docTitle]);

    const handleNameCommit = useCallback(async () => {
        setEditingName(false);
        const trimmed = nameValue.trim();
        if (!trimmed || trimmed === docTitle || !currentFilePath) return;
        try {
            const result = await window.electronAPI.libraryRename(currentFilePath, trimmed);
            setCurrentFilePath(result.filePath);
            // Update the title in the store so it reflects immediately
            store.loadDocument({ ...store.toDocument(), title: trimmed });
        } catch (err) {
            console.error('Failed to rename:', err);
        }
    }, [nameValue, docTitle, currentFilePath, store]);

    const handleNameKey = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleNameCommit();
        if (e.key === 'Escape') setEditingName(false);
    }, [handleNameCommit]);

    if (screen === 'home') {
        return <FilesHome onOpenFile={handleOpenFile} onNewFile={handleNewFile} />;
    }

    const splitClass = calendarOpen
        ? calendarSplit === 'vertical'
            ? 'split-vertical'
            : 'split-horizontal'
        : '';

    return (
        <div className="app-layout">
            {/* Back button + filename */}
            <div className="editor-topbar">
                <button className="back-btn" onClick={handleBack} title="Back to files">
                    ← Back
                </button>
                <div className="topbar-divider" />
                {editingName ? (
                    <input
                        ref={nameInputRef}
                        className="topbar-name-input"
                        value={nameValue}
                        onChange={(e) => setNameValue(e.target.value)}
                        onBlur={handleNameCommit}
                        onKeyDown={handleNameKey}
                        autoFocus
                    />
                ) : (
                    <button className="topbar-name" onClick={handleNameClick} title="Click to rename">
                        {docTitle}
                    </button>
                )}
            </div>
            <div className={`split-container ${splitClass}`}>
                <div className="split-pane split-pane-canvas">
                    <MindMapCanvas stageRef={stageRef} theme={theme} />
                </div>
                {calendarOpen && (
                    <div className="split-pane split-pane-calendar">
                        <CalendarPanel />
                    </div>
                )}
            </div>
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
