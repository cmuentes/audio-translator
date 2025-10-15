const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.send('open-file-dialog'),
  onFileSelected: (callback) => ipcRenderer.on('file-selected', (_event, value) => callback(value)),
  clearFile: () => ipcRenderer.send('clear-file'),
  translateAudio: (options) => ipcRenderer.send('translate-audio', options),
  onTranslationComplete: (callback) => ipcRenderer.on('translation-complete', (event, outputPath) => callback(outputPath)),
  onTranslationError: (callback) => ipcRenderer.on('translation-error', (event, error) => callback(error)),
  openPlaybackWindow: (filePath) => ipcRenderer.send('open-playback-window', filePath),
  closePlaybackWindow: () => ipcRenderer.send('close-playback-window'),
  openFileLocation: (filePath) => ipcRenderer.send('open-file-location', filePath),
  checkHardware: () => ipcRenderer.invoke('check-hardware'),
  getCachedModels: () => ipcRenderer.invoke('get-cached-models'),
  getTotalMemory: () => ipcRenderer.invoke('get-total-memory'),
  openModelSelection: () => ipcRenderer.send('open-model-selection'),
  onModelChosen: (callback) => ipcRenderer.on('model-chosen', (_event, value) => callback(value)),
  modelSelected: (model) => ipcRenderer.send('model-selected', model),
  closeModelSelection: () => ipcRenderer.send('close-model-selection'),
  downloadModel: (modelName) => ipcRenderer.send('download-model', modelName),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, value) => callback(value)),
  on: (channel, callback) => {
    ipcRenderer.on(channel, (event, ...args) => callback(...args));
  }
});
