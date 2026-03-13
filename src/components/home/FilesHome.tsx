import { useState, useEffect, useCallback, useRef } from 'react';

const GREETINGS = [
    "hello father here are your mindmaps",
    "father are you mindmapping",
    "miss you father i hope this doesn't crash",
    "can moley make a mindmap too",
    "love you father have fun making mindmaps"
];

interface FileEntry {
    name: string;
    filePath: string;
    updatedAt: string;
}

interface FilesHomeProps {
    onOpenFile: (filePath: string) => void;
    onNewFile: (title: string) => void;
}

export function FilesHome({ onOpenFile, onNewFile }: FilesHomeProps) {
    const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [menuFile, setMenuFile] = useState<FileEntry | null>(null);
    const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const renameRef = useRef<HTMLInputElement>(null);
    const [creating, setCreating] = useState(false);
    const [newName, setNewName] = useState('');
    const newNameRef = useRef<HTMLInputElement>(null);

    const loadFiles = useCallback(async () => {
        if (!window.electronAPI?.libraryList) return;
        const list = await window.electronAPI.libraryList();
        setFiles(list);
    }, []);

    useEffect(() => {
        loadFiles();
    }, [loadFiles]);

    // Focus rename input when it appears
    useEffect(() => {
        if (renamingPath && renameRef.current) {
            renameRef.current.focus();
            renameRef.current.select();
        }
    }, [renamingPath]);

    // Focus new name input when creating
    useEffect(() => {
        if (creating && newNameRef.current) {
            newNameRef.current.focus();
        }
    }, [creating]);

    // Close card menu when clicking elsewhere
    useEffect(() => {
        if (!menuFile) return;
        const close = () => setMenuFile(null);
        window.addEventListener('click', close);
        return () => window.removeEventListener('click', close);
    }, [menuFile]);

    const handleCreate = () => {
        setCreating(true);
        setNewName('');
    };

    const handleCreateCommit = () => {
        const title = newName.trim();
        setCreating(false);
        setNewName('');
        if (title) {
            onNewFile(title);
        }
    };

    const handleCreateDismiss = () => {
        setCreating(false);
        setNewName('');
    };

    const handleCreateKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleCreateCommit();
        if (e.key === 'Escape') handleCreateDismiss();
    };

    const handleOpen = (filePath: string) => {
        if (renamingPath) return; // don't open while renaming
        onOpenFile(filePath);
    };

    const handleCardMenu = (e: React.MouseEvent, file: FileEntry) => {
        e.stopPropagation();
        e.preventDefault();
        setMenuFile(file);
        setMenuPos({ x: e.clientX, y: e.clientY });
    };

    const handleRenameStart = (file: FileEntry) => {
        setMenuFile(null);
        setRenamingPath(file.filePath);
        setRenameValue(file.name);
    };

    const handleRenameCommit = async () => {
        if (!renamingPath || !renameValue.trim()) {
            setRenamingPath(null);
            return;
        }
        await window.electronAPI.libraryRename(renamingPath, renameValue.trim());
        setRenamingPath(null);
        await loadFiles();
    };

    const handleRenameKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameCommit();
        if (e.key === 'Escape') setRenamingPath(null);
    };

    const handleDelete = async (file: FileEntry) => {
        setMenuFile(null);
        const ok = window.confirm(`Delete "${file.name}"? This cannot be undone.`);
        if (!ok) return;
        await window.electronAPI.libraryDelete(file.filePath);
        await loadFiles();
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    return (
        <div className="files-home">
            <div className="files-header">
                <div className="files-logo">
                    <span className="files-logo-icon">🧠</span>
                    <span className="files-logo-text">MindMap</span>
                </div>
            </div>

            <div className="files-content">
                <h2 className="files-section-title">{greeting}</h2>

                <div className="files-grid">
                    {/* New file card */}
                    <button className="file-card file-card-new" onClick={handleCreate}>
                        <div className="file-card-new-icon">＋</div>
                        <div className="file-card-new-label">New Mind Map</div>
                    </button>

                    {/* File cards */}
                    {files.map((file) => (
                        <div
                            key={file.filePath}
                            className="file-card"
                            onClick={() => handleOpen(file.filePath)}
                        >
                            <div className="file-card-preview">
                                <svg viewBox="0 0 80 50" className="file-card-icon">
                                    <circle cx="40" cy="25" r="6" fill="var(--color-primary)" opacity="0.9" />
                                    <circle cx="18" cy="12" r="4" fill="var(--color-primary)" opacity="0.5" />
                                    <circle cx="18" cy="38" r="4" fill="var(--color-primary)" opacity="0.5" />
                                    <circle cx="62" cy="12" r="4" fill="var(--color-primary)" opacity="0.5" />
                                    <circle cx="62" cy="38" r="4" fill="var(--color-primary)" opacity="0.5" />
                                    <line x1="34" y1="22" x2="22" y2="14" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.4" />
                                    <line x1="34" y1="28" x2="22" y2="36" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.4" />
                                    <line x1="46" y1="22" x2="58" y2="14" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.4" />
                                    <line x1="46" y1="28" x2="58" y2="36" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.4" />
                                </svg>
                            </div>

                            <div className="file-card-info">
                                {renamingPath === file.filePath ? (
                                    <input
                                        ref={renameRef}
                                        className="file-card-rename-input"
                                        value={renameValue}
                                        onChange={(e) => setRenameValue(e.target.value)}
                                        onBlur={handleRenameCommit}
                                        onKeyDown={handleRenameKey}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                ) : (
                                    <div className="file-card-name">{file.name}</div>
                                )}
                                <div className="file-card-date">{formatDate(file.updatedAt)}</div>
                            </div>

                            <button
                                className="file-card-menu-btn"
                                onClick={(e) => handleCardMenu(e, file)}
                                title="More options"
                            >
                                ⋮
                            </button>
                        </div>
                    ))}
                </div>

                {files.length === 0 && (
                    <div className="files-empty">
                        <div className="files-empty-icon">🗂️</div>
                        <div className="files-empty-text">No mind maps yet</div>
                        <div className="files-empty-hint">Click "＋ New Mind Map" to create your first one</div>
                    </div>
                )}

                <div className="files-footer">
                    {files.length > 0 && (
                        <span className="files-count">{files.length} mind map{files.length !== 1 ? 's' : ''}</span>
                    )}
                </div>
            </div>

            {/* Card context menu */}
            {menuFile && (
                <>
                    <div className="file-menu-backdrop" onClick={() => setMenuFile(null)} />
                    <div
                        className="file-menu"
                        style={{ left: menuPos.x, top: menuPos.y }}
                    >
                        <button
                            className="file-menu-item"
                            onClick={(e) => { e.stopPropagation(); handleRenameStart(menuFile); }}
                        >
                            ✏️ Rename
                        </button>
                        <button
                            className="file-menu-item file-menu-danger"
                            onClick={(e) => { e.stopPropagation(); handleDelete(menuFile); }}
                        >
                            🗑️ Delete
                        </button>
                    </div>
                </>
            )}

            {/* New mindmap modal */}
            {creating && (
                <>
                    <div className="new-modal-backdrop" onClick={handleCreateDismiss} />
                    <div className="new-modal">
                        <div className="new-modal-title">New Mind Map</div>
                        <input
                            ref={newNameRef}
                            className="new-modal-input"
                            placeholder="Enter a name…"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={handleCreateKey}
                            autoFocus
                        />
                        <div className="new-modal-actions">
                            <button className="new-modal-cancel" onClick={handleCreateDismiss}>Cancel</button>
                            <button
                                className="new-modal-create"
                                onClick={handleCreateCommit}
                                disabled={!newName.trim()}
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
