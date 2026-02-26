import { contextBridge, ipcRenderer, webUtils } from 'electron';

export interface ElectronAPI {
    fileOpen: () => Promise<{ filePath: string; content: string } | null>;
    fileSave: (data: string) => Promise<{ filePath: string } | null>;
    fileSaveAs: (data: string) => Promise<{ filePath: string } | null>;
    fileSetDirty: (dirty: boolean) => Promise<void>;
    exportPng: (dataUrl: string) => Promise<{ filePath: string } | null>;
    exportMarkdown: (markdown: string) => Promise<{ filePath: string } | null>;
    exportJson: (json: string) => Promise<{ filePath: string } | null>;
    onMenuAction: (callback: (action: string) => void) => () => void;
    openPath: (filePath: string) => Promise<void>;
    pickFile: () => Promise<{ filePath: string; fileName: string } | null>;
    getFilePath: (file: File) => string;
}

const electronAPI: ElectronAPI = {
    fileOpen: () => ipcRenderer.invoke('file:open'),
    fileSave: (data: string) => ipcRenderer.invoke('file:save', data),
    fileSaveAs: (data: string) => ipcRenderer.invoke('file:saveAs', data),
    fileSetDirty: (dirty: boolean) => ipcRenderer.invoke('file:setDirty', dirty),
    exportPng: (dataUrl: string) => ipcRenderer.invoke('export:png', dataUrl),
    exportMarkdown: (markdown: string) => ipcRenderer.invoke('export:markdown', markdown),
    exportJson: (json: string) => ipcRenderer.invoke('export:json', json),
    openPath: (filePath: string) => ipcRenderer.invoke('shell:openPath', filePath),
    pickFile: () => ipcRenderer.invoke('dialog:pickFile'),
    getFilePath: (file: File) => webUtils.getPathForFile(file),
    onMenuAction: (callback: (action: string) => void) => {
        const actions = [
            'menu:new', 'menu:open', 'menu:save', 'menu:saveAs',
            'menu:exportPng', 'menu:exportMarkdown', 'menu:exportJson',
            'menu:undo', 'menu:redo', 'menu:tidyUp',
            'menu:zoomIn', 'menu:zoomOut', 'menu:zoomReset',
            'menu:toggleTheme', 'menu:showShortcuts',
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
