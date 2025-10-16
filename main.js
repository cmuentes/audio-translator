const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const AudioTranslator = require('./src/translation/translation-controller');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');

let mainWindow;
let playbackWindow;
let lastSelectedFilePath = null;
let voskServerProcess = null;

// --- Start Vosk Server ---
function startVoskServer() {
    const serverPath = path.join(__dirname, 'vosk-server.js');
    
    let nodePath;
    if (isDev) {
        nodePath = path.join(__dirname, 'bin', 'node');
    } else {
        nodePath = path.join(process.resourcesPath, 'bin', 'node');
    }

    if (!fs.existsSync(nodePath)) {
        dialog.showErrorBox('Node.js Executable Not Found', `Could not find the required Node.js executable at: ${nodePath}`);
        app.quit();
        return;
    }

    voskServerProcess = spawn(nodePath, [serverPath]);

    voskServerProcess.stdout.on('data', (data) => {
        console.log(`Vosk Server: ${data}`);
    });

    voskServerProcess.stderr.on('data', (data) => {
        console.log(`Vosk Server Log: ${data}`);
    });

    voskServerProcess.on('error', (err) => {
        console.error('Failed to start Vosk Server:', err);
    });

    voskServerProcess.on('exit', (code, signal) => {
        console.log(`Vosk Server process exited with code ${code}, signal ${signal}`);
    });

    voskServerProcess.on('close', (code) => {
        console.log(`Vosk Server exited with code ${code}`);
    });
}

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
    height: 900,
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

// --- App Lifecycle ---
app.whenReady().then(() => {
  startVoskServer();
  createMainWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
    if (voskServerProcess) {
        voskServerProcess.kill();
    }
});

// --- IPC Handlers ---
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

ipcMain.on('translate-audio', async (event, { sourceLang, destLang }) => {
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
            webContents: event.sender
        });

        translator.process();
    } catch (error) {
        console.error('Translation failed:', error);
        event.sender.send('translation-error', error.message);
    }
});

