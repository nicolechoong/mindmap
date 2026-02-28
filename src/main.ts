import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let currentFilePath: string | null = null;
let isDirty = false;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'MindMap',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Warn before closing with unsaved changes
  mainWindow.on('close', (e) => {
    if (isDirty && mainWindow) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: 'question',
        buttons: ['Save', "Don't Save", 'Cancel'],
        defaultId: 0,
        title: 'Unsaved Changes',
        message: 'You have unsaved changes. Do you want to save before closing?',
      });
      if (choice === 2) {
        e.preventDefault();
        return;
      }
      if (choice === 0) {
        mainWindow.webContents.send('menu:save');
        // Small delay to allow save before closing
        e.preventDefault();
        setTimeout(() => mainWindow?.destroy(), 300);
        return;
      }
    }
  });

  updateTitle();
};

function updateTitle() {
  if (!mainWindow) return;
  const name = currentFilePath ? path.basename(currentFilePath) : 'Untitled';
  const dirty = isDirty ? ' •' : '';
  mainWindow.setTitle(`${name}${dirty} — MindMap`);
}

// ── Native Menu ───────────────────────────────────────────────────────────

function buildMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.send('menu:new'),
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: () => mainWindow?.webContents.send('menu:open'),
        },
        { type: 'separator' },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow?.webContents.send('menu:save'),
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow?.webContents.send('menu:saveAs'),
        },
        { type: 'separator' },
        {
          label: 'Export as PNG...',
          click: () => mainWindow?.webContents.send('menu:exportPng'),
        },
        {
          label: 'Export as Markdown...',
          click: () => mainWindow?.webContents.send('menu:exportMarkdown'),
        },
        {
          label: 'Export as JSON...',
          click: () => mainWindow?.webContents.send('menu:exportJson'),
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow?.webContents.send('menu:undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow?.webContents.send('menu:redo'),
        },
        { type: 'separator' },
        {
          label: 'Tidy Up',
          accelerator: 'CmdOrCtrl+Shift+L',
          click: () => mainWindow?.webContents.send('menu:tidyUp'),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => mainWindow?.webContents.send('menu:zoomIn'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow?.webContents.send('menu:zoomOut'),
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.send('menu:zoomReset'),
        },
        { type: 'separator' },
        {
          label: 'Expand All',
          click: () => mainWindow?.webContents.send('menu:expandAll'),
        },
        { type: 'separator' },
        {
          label: 'Toggle Theme',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => mainWindow?.webContents.send('menu:toggleTheme'),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          click: () => mainWindow?.webContents.send('menu:showShortcuts'),
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// ── IPC Handlers ──────────────────────────────────────────────────────────

ipcMain.handle('file:open', async () => {
  const result = await dialog.showOpenDialog({
    filters: [
      { name: 'MindMap Files', extensions: ['mindmap'] },
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  currentFilePath = filePath;
  isDirty = false;
  updateTitle();
  return { filePath, content };
});

ipcMain.handle('file:save', async (_event, data: string) => {
  if (!currentFilePath) {
    // Fallback to saveAs
    const result = await dialog.showSaveDialog({
      filters: [
        { name: 'MindMap Files', extensions: ['mindmap'] },
        { name: 'JSON Files', extensions: ['json'] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    currentFilePath = result.filePath;
  }
  fs.writeFileSync(currentFilePath, data, 'utf-8');
  isDirty = false;
  updateTitle();
  return { filePath: currentFilePath };
});

ipcMain.handle('file:saveAs', async (_event, data: string) => {
  const result = await dialog.showSaveDialog({
    filters: [
      { name: 'MindMap Files', extensions: ['mindmap'] },
      { name: 'JSON Files', extensions: ['json'] },
    ],
  });

  if (result.canceled || !result.filePath) return null;

  fs.writeFileSync(result.filePath, data, 'utf-8');
  currentFilePath = result.filePath;
  isDirty = false;
  updateTitle();
  return { filePath: result.filePath };
});

ipcMain.handle('file:setDirty', (_event, dirty: boolean) => {
  isDirty = dirty;
  updateTitle();
});

ipcMain.handle('export:png', async (_event, dataUrl: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return null;

  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(result.filePath, Buffer.from(base64Data, 'base64'));
  return { filePath: result.filePath };
});

ipcMain.handle('export:markdown', async (_event, markdown: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });
  if (result.canceled || !result.filePath) return null;

  fs.writeFileSync(result.filePath, markdown, 'utf-8');
  return { filePath: result.filePath };
});

ipcMain.handle('export:json', async (_event, json: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return null;

  fs.writeFileSync(result.filePath, json, 'utf-8');
  return { filePath: result.filePath };
});

// ── Attachment IPC ────────────────────────────────────────────────────────

ipcMain.handle('shell:openPath', async (_event, filePath: string) => {
  await shell.openPath(filePath);
});

ipcMain.handle('dialog:pickFile', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const fileName = path.basename(filePath);
  return { filePath, fileName };
});

// ── App lifecycle ─────────────────────────────────────────────────────────

app.on('ready', () => {
  buildMenu();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
