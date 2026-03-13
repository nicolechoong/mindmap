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

// ── Library Directory ─────────────────────────────────────────────────────

function getLibraryDir(): string {
  const dir = path.join(app.getPath('documents'), 'MindMap');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function uniqueFilePath(dir: string, baseName: string, ext: string): string {
  let filePath = path.join(dir, `${baseName}${ext}`);
  let counter = 1;
  while (fs.existsSync(filePath)) {
    filePath = path.join(dir, `${baseName} (${counter})${ext}`);
    counter++;
  }
  return filePath;
}

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
          label: 'Export as .mindmap...',
          click: () => mainWindow?.webContents.send('menu:exportMindmap'),
        },
        {
          label: 'Export as PNG...',
          click: () => mainWindow?.webContents.send('menu:exportPng'),
        },
        {
          label: 'Export as JPG...',
          click: () => mainWindow?.webContents.send('menu:exportJpg'),
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
        {
          label: 'Toggle Calendar',
          accelerator: 'CmdOrCtrl+Shift+K',
          click: () => mainWindow?.webContents.send('menu:toggleCalendar'),
        },
        {
          label: 'Toggle Calendar Split',
          click: () => mainWindow?.webContents.send('menu:toggleCalendarSplit'),
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

  let filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');

  // Copy into library if not already there
  const libraryDir = getLibraryDir();
  if (!filePath.startsWith(libraryDir)) {
    const baseName = path.basename(filePath, path.extname(filePath));
    const destPath = uniqueFilePath(libraryDir, baseName, '.mindmap');
    fs.copyFileSync(filePath, destPath);
    filePath = destPath;
  }

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

ipcMain.handle('export:jpg', async (_event, dataUrl: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'JPG Image', extensions: ['jpg', 'jpeg'] }],
  });
  if (result.canceled || !result.filePath) return null;

  const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');
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

ipcMain.handle('export:mindmap', async (_event, data: string) => {
  const result = await dialog.showSaveDialog({
    filters: [{ name: 'MindMap File', extensions: ['mindmap'] }],
  });
  if (result.canceled || !result.filePath) return null;

  fs.writeFileSync(result.filePath, data, 'utf-8');
  return { filePath: result.filePath };
});

// ── Library IPC ──────────────────────────────────────────────────────────

ipcMain.handle('library:list', async () => {
  const dir = getLibraryDir();
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mindmap'));
  const result: { name: string; filePath: string; updatedAt: string }[] = [];
  for (const file of files) {
    const filePath = path.join(dir, file);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const doc = JSON.parse(raw);
      result.push({
        name: doc.title || path.basename(file, '.mindmap'),
        filePath,
        updatedAt: doc.updatedAt || fs.statSync(filePath).mtime.toISOString(),
      });
    } catch {
      // If JSON parsing fails, still list the file
      result.push({
        name: path.basename(file, '.mindmap'),
        filePath,
        updatedAt: fs.statSync(filePath).mtime.toISOString(),
      });
    }
  }
  // Sort newest first
  result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  return result;
});

ipcMain.handle('library:create', async (_event, title: string) => {
  const dir = getLibraryDir();
  const filePath = uniqueFilePath(dir, title, '.mindmap');
  // Write a minimal document skeleton
  const doc = {
    version: 1,
    title,
    rootIds: [],
    nodes: {},
    edges: {},
    links: {},
    manualPositions: {},
    theme: {},
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8');
  currentFilePath = filePath;
  isDirty = false;
  updateTitle();
  return { filePath };
});

ipcMain.handle('library:rename', async (_event, filePath: string, newName: string) => {
  const dir = path.dirname(filePath);
  const newPath = uniqueFilePath(dir, newName, '.mindmap');
  // Also update the title inside the JSON
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const doc = JSON.parse(raw);
    doc.title = newName;
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2), 'utf-8');
  } catch { /* ignore parse errors */ }
  fs.renameSync(filePath, newPath);
  // Update currentFilePath if it was the active file
  if (currentFilePath === filePath) {
    currentFilePath = newPath;
    updateTitle();
  }
  return { filePath: newPath };
});

ipcMain.handle('library:delete', async (_event, filePath: string) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  if (currentFilePath === filePath) {
    currentFilePath = null;
    isDirty = false;
    updateTitle();
  }
});

ipcMain.handle('library:read', async (_event, filePath: string) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  currentFilePath = filePath;
  isDirty = false;
  updateTitle();
  return { filePath, content };
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
