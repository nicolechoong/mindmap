import { useState, useCallback, useRef, useEffect } from 'react';
import { MindMapCanvas } from './components/canvas/MindMapCanvas';
import { FloatingBar } from './components/toolbar/FloatingBar';
import { RootNodesPanel } from './components/toolbar/RootNodesPanel';
import { IconArrowLeft, IconSettings } from './components/common/SimpleIcon';
import { ShortcutsModal } from './components/shortcuts/ShortcutsModal';
import { SettingsModal } from './components/settings/SettingsModal';
import { CalendarPanel } from './components/calendar/CalendarPanel';
import { FilesHome } from './components/home/FilesHome';
import { useKeyboard } from './hooks/useKeyboard';
import { useMenuActions } from './hooks/useMenuActions';
import { useMindMapStore } from './store/store';
import { MiniMap } from './components/canvas/MiniMap';

export function App() {
    const [screen, setScreen] = useState<'home' | 'editor'>('home');
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [currentFilePath, setCurrentFilePath] = useState<string | null>(null);
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState('');
    const nameInputRef = useRef<HTMLInputElement>(null);
    const stageRef = useRef<any>(null);
    const [isBooting, setIsBooting] = useState(true);
    const viewport = useMindMapStore((s) => s.viewport);
    const calendarOpen = useMindMapStore((s) => s.calendarOpen);
    const calendarSplit = useMindMapStore((s) => s.calendarSplit);
    const docTitle = useMindMapStore((s) => s.title);
    const store = useMindMapStore();
    const appSettings = useMindMapStore((s) => s.appSettings);
    const setAppSettings = useMindMapStore((s) => s.setAppSettings);
    const setConnectorStyle = useMindMapStore((s) => s.setConnectorStyle);

    // Setup background auto-save loop
    useEffect(() => {
        if (screen !== 'editor' || !currentFilePath) return;

        const timeoutId = setTimeout(() => {
            try {
                const doc = store.toDocument();
                window.electronAPI.libraryUpdate(currentFilePath, JSON.stringify(doc, null, 2));
            } catch (err) {
                console.error('Auto-save failed:', err);
            }
        }, 2000);

        return () => clearTimeout(timeoutId);
    }, [store, screen, currentFilePath]);

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

    // Handle menu:openSettings from native menu
    useEffect(() => {
        const unsub = window.electronAPI.onMenuAction((action) => {
            if (action === 'openSettings') setShowSettings(true);
        });
        return unsub;
    }, []);

    // Load settings from disk on boot
    useEffect(() => {
        window.electronAPI.getSettings().then((s) => {
            setAppSettings(s);
            const t = s.theme ?? 'light';
            setTheme(t);
            document.documentElement.setAttribute('data-theme', t);
        }).catch((_e) => { /* ignore if settings not yet written */ });
    }, []);

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

    // Initial boot auto-open
    useEffect(() => {
        window.electronAPI.getLastOpened()
            .then((lastOpenedPath) => {
                if (lastOpenedPath) {
                    return handleOpenFile(lastOpenedPath);
                }
            })
            .catch(() => {
                // ignore
            })
            .finally(() => {
                setIsBooting(false);
            });
    }, []);

    // Sync dirty state to main process
    useEffect(() => {
        window.electronAPI.fileSetDirty(store.isDirty).catch(() => {
            // ignore
        });
    }, [store.isDirty]);

    // Prevent default drag and drop behavior to avoid opening dropped files in the app
    useEffect(() => {
        const preventDefault = (e: DragEvent) => e.preventDefault();
        window.addEventListener('dragover', preventDefault);
        window.addEventListener('drop', preventDefault);
        return () => {
            window.removeEventListener('dragover', preventDefault);
            window.removeEventListener('drop', preventDefault);
        };
    }, []);

    // Auto-save effect
    useEffect(() => {
        const interval = Number(appSettings.autoSaveInterval);
        if (!interval || interval === 0) return;
        const timer = setInterval(async () => {
            if (!currentFilePath || !store.isDirty) return;
            try {
                const doc = store.toDocument();
                await window.electronAPI.fileSave(JSON.stringify(doc, null, 2));
                store.setDirty(false);
            } catch { /* ignore */ }
        }, interval * 1000);
        return () => clearInterval(timer);
    }, [appSettings.autoSaveInterval, currentFilePath, store.isDirty]);

    const handleBack = useCallback(async () => {
        if (store.isDirty) {
            const promptResult = await window.electronAPI.confirmClose();
            if (promptResult === 'cancel') {
                return;
            }
            if (promptResult === 'save') {
                try {
                    const doc = store.toDocument();
                    await window.electronAPI.fileSave(JSON.stringify(doc, null, 2));
                } catch { /* ignore */ }
            }
        }
        await window.electronAPI.clearLastOpened();
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

    const splitClass = calendarOpen
        ? calendarSplit === 'vertical'
            ? 'split-vertical'
            : 'split-horizontal'
        : '';

    return (
        <div className="app-layout">
            {isBooting ? (
                <div className="boot-screen"></div>
            ) : screen === 'home' ? (
                <FilesHome
                    onOpenFile={handleOpenFile}
                    onNewFile={handleNewFile}
                />
            ) : (
                <>
                    {/* Back button + filename */}
                    <div className="editor-topbar">
                        <button className="back-btn" onClick={handleBack} title="Back to files">
                            <IconArrowLeft size={16} />
                            <span style={{ marginLeft: 4 }}>Back</span>
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
                        <div style={{ flex: 1 }} />
                        <button
                            className="topbar-settings-btn"
                            title="Settings (⌘,)"
                            onClick={() => setShowSettings(true)}
                        >
                            <IconSettings size={18} />
                        </button>
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
                    <RootNodesPanel />
                    <MiniMap theme={theme} />
                </>
            )}
            {showShortcuts && (
                <ShortcutsModal onClose={() => setShowShortcuts(false)} />
            )}
            <SettingsModal
                open={showSettings}
                onClose={() => setShowSettings(false)}
                onThemeChange={(t) => {
                    setTheme(t);
                    document.documentElement.setAttribute('data-theme', t);
                }}
            />
        </div>
    );
}
