// This file contains utility functions for the audio translation process,
// such as checking for hardware acceleration and finding cached models.

const fs = require('fs').promises;
const path = require('path');
const { env, pipeline } = require('@xenova/transformers');


// Re-define env configuration here as it's a standalone module.
env.allowLocalModels = true;
const appDataPath = process.env.APPDATA || (process.platform == 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
env.cacheDir = path.join(appDataPath, 'electron-audio-translator-cache');
env.localModelPath = path.join(appDataPath, 'electron-audio-translator-cache');

/**
 * Checks for hardware acceleration capabilities by trying to load the native ONNX runtime.
 * @returns {Promise<boolean>} True if native ONNX runtime is available, otherwise false.
 */
async function checkHardware() {
    try {
        // The presence of the native ONNX runtime indicates potential for GPU/hardware acceleration.
        require('@xenova/transformers').onnx;
        return true;
    } catch (e) {
        console.warn("Hardware check failed: Could not load native ONNX runtime. Transcription will use CPU only and may be slow.");
        return false;
    }
}

/**
 * Scans the cache directory and returns a list of all downloaded Whisper models.
 * @returns {Promise<string[]>} An array of cached model names (e.g., ['tiny', 'base']).
 */
async function getCachedModels() {
    const possibleModels = ['tiny', 'base', 'small', 'medium', 'large'];
    const cachedModels = [];

    for (const model of possibleModels) {
        const modelId = `Xenova/whisper-${model}`;
        // Correctly join the path components for nested directories.
        const modelDir = path.join(env.cacheDir, ...modelId.split('/'));
        const configFile = path.join(modelDir, 'config.json');

        try {
            // Check if the model's config file exists in the cache.
            await fs.access(configFile);
            cachedModels.push(model);
        } catch (error) {
            // File doesn't exist, so model is not cached. Continue to the next.
        }
    }

    if (cachedModels.length > 0) {
        console.log(`Found cached models: ${cachedModels.join(', ')}`);
    } else {
        console.log("No models are currently cached.");
    }

    return cachedModels;
}

/**
 * Downloads and caches a specified Whisper model.
 * @param {string} modelName The name of the model to download (e.g., 'tiny', 'base').
 * @param {function} [progressCallback] Optional callback to report download progress.
 * @returns {Promise<void>} A promise that resolves when the model is downloaded.
 */
async function downloadModel(modelName, progressCallback = null) {
    const modelId = `Xenova/whisper-${modelName}`;

    try {
        await pipeline('automatic-speech-recognition', modelId, {
            progress_callback: (progress) => {
                if (typeof progress.progress === 'number') {
                    console.log(`Downloading ${progress.file}: ${Math.round(progress.progress)}%`);
                }
                if (progressCallback) {
                    progressCallback(progress);
                }
            },
        });
    } catch (error) {
        console.error(`Failed to download model '${modelName}':`, error);
        throw error;
    }
}


module.exports = {
    checkHardware,
    getCachedModels,
    downloadModel,
    env,
};