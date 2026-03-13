import { contextBridge, ipcRenderer, webUtils } from 'electron';

export interface ElectronAPI {
    fileOpen: () => Promise<{ filePath: string; content: string } | null>;
    fileSave: (data: string) => Promise<{ filePath: string } | null>;
    fileSaveAs: (data: string) => Promise<{ filePath: string } | null>;
    fileSetDirty: (dirty: boolean) => Promise<void>;
    exportPng: (dataUrl: string) => Promise<{ filePath: string } | null>;
    exportJpg: (dataUrl: string) => Promise<{ filePath: string } | null>;
    exportMarkdown: (markdown: string) => Promise<{ filePath: string } | null>;
    exportJson: (json: string) => Promise<{ filePath: string } | null>;
    exportMindmap: (data: string) => Promise<{ filePath: string } | null>;
    onMenuAction: (callback: (action: string) => void) => () => void;
    openPath: (filePath: string) => Promise<void>;
    pickFile: () => Promise<{ filePath: string; fileName: string } | null>;
    getFilePath: (file: File) => string;
    // Library
    libraryList: () => Promise<{ name: string; filePath: string; updatedAt: string }[]>;
    libraryCreate: (title: string) => Promise<{ filePath: string }>;
    libraryRename: (filePath: string, newName: string) => Promise<{ filePath: string }>;
    libraryDelete: (filePath: string) => Promise<void>;
    libraryRead: (filePath: string) => Promise<{ filePath: string; content: string }>;
}

const electronAPI: ElectronAPI = {
    fileOpen: () => ipcRenderer.invoke('file:open'),
    fileSave: (data: string) => ipcRenderer.invoke('file:save', data),
    fileSaveAs: (data: string) => ipcRenderer.invoke('file:saveAs', data),
    fileSetDirty: (dirty: boolean) => ipcRenderer.invoke('file:setDirty', dirty),
    exportPng: (dataUrl: string) => ipcRenderer.invoke('export:png', dataUrl),
    exportJpg: (dataUrl: string) => ipcRenderer.invoke('export:jpg', dataUrl),
    exportMarkdown: (markdown: string) => ipcRenderer.invoke('export:markdown', markdown),
    exportJson: (json: string) => ipcRenderer.invoke('export:json', json),
    exportMindmap: (data: string) => ipcRenderer.invoke('export:mindmap', data),
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
    pickFile: () => ipcRenderer.invoke('dialog:pickFile'),
    getFilePath: (file: File) => webUtils.getPathForFile(file),
    // Library
    libraryList: () => ipcRenderer.invoke('library:list'),
    libraryCreate: (title: string) => ipcRenderer.invoke('library:create', title),
    libraryRename: (filePath: string, newName: string) => ipcRenderer.invoke('library:rename', filePath, newName),
    libraryDelete: (filePath: string) => ipcRenderer.invoke('library:delete', filePath),
    libraryRead: (filePath: string) => ipcRenderer.invoke('library:read', filePath),
    onMenuAction: (callback: (action: string) => void) => {
        const actions = [
            'menu:new', 'menu:open', 'menu:save', 'menu:saveAs',
            'menu:exportMindmap', 'menu:exportPng', 'menu:exportJpg', 'menu:exportMarkdown', 'menu:exportJson',
            'menu:undo', 'menu:redo', 'menu:tidyUp',
            'menu:expandAll',
            'menu:zoomIn', 'menu:zoomOut', 'menu:zoomReset',
            'menu:toggleTheme', 'menu:showShortcuts',
            'menu:toggleCalendar',
            'menu:toggleCalendarSplit',
        ];
        const handler = (_event: Electron.IpcRendererEvent) => {
            // The channel name IS the action
        };
        const handlers = actions.map((action) => {
            const h = () => callback(action.replace('menu:', ''));
            ipcRenderer.on(action, h);
            return { action, h };
        });
        return () => {
            for (const { action, h } of handlers) {
                ipcRenderer.removeListener(action, h);
            }
        };
    },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
