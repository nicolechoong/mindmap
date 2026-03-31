import { useState, useEffect } from 'react';
import { useMindMapStore } from '../../store/store';
import { 
    IconSettings, IconX, IconSun, IconMoon,
    IconCurve, IconCornerDownRight, IconStraight
} from '../common/SimpleIcon';
import type { AppSettings } from '../../types';

interface SettingsModalProps {
    open: boolean;
    onClose: () => void;
    onThemeChange: (theme: 'light' | 'dark') => void;
}

export function SettingsModal({ open, onClose, onThemeChange }: SettingsModalProps) {
    const appSettings = useMindMapStore((s) => s.appSettings);
    const setAppSettings = useMindMapStore((s) => s.setAppSettings);
    const currentLineStyle = useMindMapStore((s) => s.lineStyle);
    const currentAnchor = useMindMapStore((s) => s.connectorAnchor);
    const setLineStyle = useMindMapStore((s) => s.setLineStyle);
    const setConnectorAnchor = useMindMapStore((s) => s.setConnectorAnchor);

    const [settings, setSettings] = useState<AppSettings>(appSettings);
    const [libraryPathDisplay, setLibraryPathDisplay] = useState('');

    // Load settings from disk on mount / open
    useEffect(() => {
        if (!open) return;
        window.electronAPI.getSettings().then((s) => {
            const merged: AppSettings = {
                libraryPath: s.libraryPath ?? '',
                defaultConnectorStyle: s.defaultConnectorStyle ?? 'orthogonal',
                autoSaveInterval: s.autoSaveInterval ?? 60,
                theme: s.theme ?? 'light',
                inheritParentColor: s.inheritParentColor ?? false,
            };
            setSettings(merged);
            setAppSettings(merged);
            setLibraryPathDisplay(s.libraryPath || '~/Documents/MindMap (default)');
        });
    }, [open]);

    const savePatch = (patch: Partial<AppSettings>) => {
        const next = { ...settings, ...patch };
        setSettings(next);
        setAppSettings(next);
        window.electronAPI.setSettings(patch as Record<string, unknown>);
    };

    const handlePickFolder = async () => {
        const folderPath = await window.electronAPI.pickFolder();
        if (folderPath) {
            setLibraryPathDisplay(folderPath);
            savePatch({ libraryPath: folderPath });
        }
    };

    const handleThemeChange = (theme: 'light' | 'dark') => {
        savePatch({ theme });
        onThemeChange(theme);
    };

    if (!open) return null;

    return (
        <>
            <div className="settings-backdrop" onClick={onClose} />
            <div className="settings-panel">
                <div className="settings-header">
                    <h2 className="settings-title">
                        <IconSettings size={20} style={{ marginRight: 8, verticalAlign: 'middle' }} />
                        Settings
                    </h2>
                    <button className="settings-close-btn" onClick={onClose} title="Close">
                        <IconX size={16} />
                    </button>
                </div>

                <div className="settings-body">
                    {/* ── General ─────────────────────────────── */}
                    <section className="settings-section">
                        <h3 className="settings-section-title">General</h3>

                        <div className="settings-row">
                            <label className="settings-label">
                                Library Folder
                                <span className="settings-hint">Where your .mindmap files are saved</span>
                            </label>
                            <div className="settings-folder-row">
                                <span className="settings-folder-path" title={libraryPathDisplay}>
                                    {libraryPathDisplay}
                                </span>
                                <button className="settings-pick-btn" onClick={handlePickFolder}>
                                    Choose…
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ── Theme ───────────────────────────────── */}
                    <section className="settings-section">
                        <h3 className="settings-section-title">Appearance</h3>

                        <div className="settings-row">
                            <label className="settings-label">
                                Theme
                                <span className="settings-hint">Canvas and interface colour scheme</span>
                            </label>
                            <div className="settings-segmented">
                                <button
                                    className={`settings-seg-btn${settings.theme === 'light' ? ' active' : ''}`}
                                    onClick={() => handleThemeChange('light')}
                                    title="Switch to light mode"
                                >
                                    <IconSun size={14} style={{ marginRight: 6 }} />
                                    Light
                                </button>
                                <button
                                    className={`settings-seg-btn${settings.theme === 'dark' ? ' active' : ''}`}
                                    onClick={() => handleThemeChange('dark')}
                                    title="Switch to dark mode"
                                >
                                    <IconMoon size={14} style={{ marginRight: 6 }} />
                                    Dark
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* ── Connectors ──────────────────────────── */}
                    <section className="settings-section">
                        <h3 className="settings-section-title">Connectors</h3>

                        <div className="settings-row">
                            <label className="settings-label">
                                Line Style
                                <span className="settings-hint">Shape of the connector lines</span>
                            </label>
                            <div className="settings-segmented">
                                {(['bezier', 'orthogonal', 'straight'] as const).map((style) => (
                                    <button
                                        key={style}
                                        className={`settings-seg-btn${currentLineStyle === style ? ' active' : ''}`}
                                        onClick={() => setLineStyle(style)}
                                        title={`Use ${style} connector lines`}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {style === 'bezier' ? <IconCurve size={14} /> : style === 'orthogonal' ? <IconCornerDownRight size={14} /> : <IconStraight size={14} />}
                                            {style === 'bezier' ? 'Curved' : style === 'orthogonal' ? 'Right-angle' : 'Straight'}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="settings-row">
                            <label className="settings-label">
                                Horizontal Anchors
                                <span className="settings-hint">Force connectors to exit/enter from left and right sides only</span>
                            </label>
                            <button
                                className={`settings-toggle-btn${currentAnchor === 'horizontal' ? ' active' : ''}`}
                                onClick={() => setConnectorAnchor(currentAnchor === 'horizontal' ? 'adaptive' : 'horizontal')}
                                role="switch"
                                aria-checked={currentAnchor === 'horizontal'}
                            >
                                <span className="settings-toggle-track">
                                    <span className="settings-toggle-thumb" />
                                </span>
                                <span className="settings-toggle-label">
                                    {currentAnchor === 'horizontal' ? 'On' : 'Off'}
                                </span>
                            </button>
                        </div>
                    </section>

                    {/* ── Auto-Save ───────────────────────────── */}
                    <section className="settings-section">
                        <h3 className="settings-section-title">Auto-Save</h3>

                        <div className="settings-row">
                            <label className="settings-label">
                                Auto-Save Interval
                                <span className="settings-hint">Automatically save the current document</span>
                            </label>
                            <div className="settings-segmented">
                                {([
                                    [0, 'Off'],
                                    [30, '30s'],
                                    [60, '1 min'],
                                    [300, '5 min'],
                                ] as [0 | 30 | 60 | 300, string][]).map(([val, label]) => (
                                    <button
                                        key={val}
                                        className={`settings-seg-btn${settings.autoSaveInterval === val ? ' active' : ''}`}
                                        onClick={() => savePatch({ autoSaveInterval: val })}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>
                    {/* ── Nodes ───────────────────────────────── */}
                    <section className="settings-section">
                        <h3 className="settings-section-title">Nodes</h3>

                        <div className="settings-row">
                            <label className="settings-label">
                                Inherit Parent Color
                                <span className="settings-hint">New child nodes automatically copy the parent's fill color</span>
                            </label>
                            <button
                                className={`settings-toggle-btn${settings.inheritParentColor ? ' active' : ''}`}
                                onClick={() => savePatch({ inheritParentColor: !settings.inheritParentColor })}
                                role="switch"
                                aria-checked={settings.inheritParentColor}
                            >
                                <span className="settings-toggle-track">
                                    <span className="settings-toggle-thumb" />
                                </span>
                                <span className="settings-toggle-label">
                                    {settings.inheritParentColor ? 'On' : 'Off'}
                                </span>
                            </button>
                        </div>
                    </section>
                </div>
            </div>
        </>
    );
}
