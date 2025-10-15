const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { checkHardware, getCachedModels, downloadModel } = require('./src/translation/translation-utils');
const AudioTranslator = require('./src/translation/translation-controller');

let mainWindow;
let modelSelectionWindow;
let playbackWindow;
let lastSelectedFilePath = null;

// --- Global Error Handling ---
process.on('uncaughtException', (error) => {
    console.error('Unhandled Exception:', error);
    const errorMessage = error.stack || error.message || 'An unknown error occurred';
    dialog.showErrorBox('Unhandled Exception', errorMessage);
    app.quit();
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', reason);
    const reasonMessage = reason.stack || String(reason) || 'An unknown rejection occurred';
    dialog.showErrorBox('Unhandled Rejection', reasonMessage);
    app.quit();
});

// --- Window Creation ---
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });
  mainWindow.loadFile('index.html');
}

function createPlaybackWindow(filePath) {
    playbackWindow = new BrowserWindow({
        width: 500,
        height: 300,
        title: 'Translation Playback',
        parent: mainWindow,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
        },
    });
    playbackWindow.loadFile('playback.html');
    playbackWindow.webContents.on('did-finish-load', () => {
        playbackWindow.webContents.send('set-audio-path', filePath);
    });
    playbackWindow.on('closed', () => playbackWindow = null);
}

function createModelSelectionWindow() {
    modelSelectionWindow = new BrowserWindow({
        width: 950,
        height: 580,
        title: 'Select a Model',
        parent: mainWindow,
        modal: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
        },
    });
    modelSelectionWindow.loadFile('model-selection.html');
    modelSelectionWindow.on('closed', () => modelSelectionWindow = null);
}

// --- App Lifecycle ---
app.whenReady().then(() => {
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC Handlers ---
ipcMain.handle('check-hardware', () => checkHardware());
ipcMain.handle('get-cached-models', () => getCachedModels());
ipcMain.handle('get-total-memory', () => os.totalmem());

ipcMain.on('open-model-selection', () => createModelSelectionWindow());
ipcMain.on('close-model-selection', () => modelSelectionWindow?.close());
ipcMain.on('model-selected', (event, model) => {
    mainWindow.webContents.send('model-chosen', model);
    modelSelectionWindow?.close();
});

ipcMain.on('download-model', async (event, modelName) => {
    await downloadModel(modelName, (progress) => {
        modelSelectionWindow?.webContents.send('download-progress', { ...progress, model: modelName });
    });
});

ipcMain.on('open-playback-window', (event, filePath) => createPlaybackWindow(filePath));
ipcMain.on('close-playback-window', () => playbackWindow?.close());

ipcMain.on('open-file-location', (event, filePath) => shell.showItemInFolder(filePath));

ipcMain.on('open-file-dialog', (event) => {
    dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [{ name: 'Audio Files', extensions: ['mp3', 'wav', 'ogg', 'opus', 'm4a', 'flac'] }]
    }).then(result => {
        if (!result.canceled && result.filePaths.length > 0) {
            lastSelectedFilePath = result.filePaths[0];
            event.sender.send('file-selected', {
                name: path.basename(lastSelectedFilePath),
                path: lastSelectedFilePath
            });
        }
    }).catch(err => console.error('File dialog error:', err));
});

ipcMain.on('clear-file', () => {
    lastSelectedFilePath = null;
});

ipcMain.on('translate-audio', async (event, { sourceLang, destLang, model }) => {
    if (!lastSelectedFilePath) {
        event.sender.send('translation-error', 'No file selected.');
        return;
    }
    
    try {
        const outputDir = path.join(app.getPath('downloads'), 'translator-app');
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const translator = new AudioTranslator({
            inputFile: lastSelectedFilePath,
            inputLang: sourceLang,
            outputLang: destLang,
            outputDir: outputDir,
            model: model || 'base',
            webContents: event.sender
        });

        translator.process();
    } catch (error) {
        console.error('Translation failed:', error);
        event.sender.send('translation-error', error.message);
    }
});

