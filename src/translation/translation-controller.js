const fs = require('fs');
const { promises: fsPromises } = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { exec } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
const axios = require('axios');
const { getAllAudioUrls } = require('google-tts-api');
const TranslationResults = require('./translation-results');
const { Worker } = require('worker_threads');
const FormData = require('form-data');

const LANGUAGES = {
    'en': { sr_code: 'en-US', translator_code: 'en' },
    'es': { sr_code: 'es-ES', translator_code: 'es' },
    'fr': { sr_code: 'fr-FR', translator_code: 'fr' },
    'it': { sr_code: 'it-IT', translator_code: 'it' }
};

class AudioTranslator {
    /**
     * Initializes the translator.
     * @param {object} options - Configuration for the translation task.
     * @param {string} options.inputFile - Full path to the source audio file.
     * @param {string} options.inputLang - Source language (e.g., 'english').
     * @param {string} options.outputLang - Destination language (e.g., 'spanish').
     * @param {string} options.outputDir - Directory to save the translated file.
     * @param {string} [options.modelPath] - Path to the Vosk model.
     * @param {string} [options.outputName] - Optional output filename.
     */
    constructor(options) {
        if (!options.inputFile || !options.inputLang || !options.outputLang || !options.outputDir) {
            throw new Error("Missing required options: inputFile, inputLang, outputLang, and outputDir must be provided.");
        }
        if (!options.webContents) {
            throw new Error("Missing required option: webContents must be provided.");
        }
        this.inputFile = options.inputFile;
        this.inputLang = LANGUAGES[options.inputLang];
        this.outputLang = LANGUAGES[options.outputLang];
        this.outputDir = options.outputDir;
        this.outputName = options.outputName || `translation_${uuidv4()}`;
        this.outputFilePath = path.join(this.outputDir, `${this.outputName}.mp3`);
        this.webContents = options.webContents;
    }

    /**
     * Executes the entire audio processing workflow and returns the results.
     */
    async process() {
        console.log(`Starting audio processing for: ${this.inputFile}`);
        let tempWavFile = null;

        try {
            tempWavFile = await this._convertToWav();
            const originalText = await this._transcribe(tempWavFile);
            if (!originalText) {
                throw new Error("Transcription failed to produce any text.");
            }
            console.log("\nTranscribed Text:", originalText);
            this.webContents.send('translation-progress', {
                type: 'transcription',
                data: originalText
            });

            const translatedText = await this._translate(originalText);
            console.log(`\nTranslated Text (${this.outputLang.translator_code}):`, translatedText);
            this.webContents.send('translation-progress', {
                type: 'translation',
                data: translatedText
            });

            await this._synthesizeSpeech(translatedText);
            await this._speedUpAudio();

            console.log(`\nSuccessfully created file at: ${this.outputFilePath}`);
            this.webContents.send('translation-complete', this.outputFilePath);

        } catch (error) {
            console.error("\n--- An error occurred during the process ---", error);
            this.webContents.send('translation-error', error.message);
        } finally {
            if (tempWavFile && tempWavFile !== this.inputFile) {
                await fsPromises.unlink(tempWavFile).catch(e => console.error("Error removing temp file:", e));
            }
        }
    }

    _convertToWav() {
        return new Promise((resolve, reject) => {
            const tempPath = path.join(os.tmpdir(), `${uuidv4()}.wav`);
            console.log(`Converting to temporary WAV at ${tempPath}...`);
            ffmpeg(this.inputFile)
                .toFormat('wav')
                .audioChannels(1)
                .audioFrequency(16000)
                .on('error', (err) => reject(new Error(`FFmpeg error: ${err.message}`)))
                .on('end', () => resolve(tempPath))
                .save(tempPath);
        });
    }

    async _transcribe(filePath) {
        try {
            console.log(`Sending audio file to Vosk server for transcription...`);
    
            const form = new FormData();
            form.append('audio', fs.createReadStream(filePath));
            form.append('lang', this.inputLang.translator_code);
    
            const response = await axios.post('http://localhost:3000/transcribe', form, {
                headers: form.getHeaders(),
            });
    
            if (response.data && response.data.transcription) {
                return response.data.transcription;
            } else {
                throw new Error('Transcription failed: Invalid response from server.');
            }
        } catch (error) {
            if (error.response) {
                console.error('Transcription server error:', error.response.data);
                throw new Error(`Transcription server error: ${error.response.data.error || 'Unknown error'}`);
            } else if (error.request) {
                console.error('Transcription server did not respond:', error.request);
                throw new Error('Transcription server did not respond. Is it running?');
            } else {
                console.error('Error setting up transcription request:', error.message);
                throw new Error(`Error setting up transcription request: ${error.message}`);
            }
        }
    }

    _translate(text) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`Starting translation worker...`);
    
                const worker = new Worker(path.join(__dirname, 'translation.worker.js'), {
                    env: {
                        NODE_OPTIONS: '--max-old-space-size=8192'
                    }
                });
    
                worker.on('message', (message) => {
                    if (message.status === 'completed') {
                        resolve(message.output);
                    } else {
                        reject(new Error(`Translation worker error: ${message.output}`));
                    }
                    worker.terminate();
                });
    
                worker.on('error', (err) => {
                    reject(err);
                    worker.terminate();
                });
    
                worker.on('exit', (code) => {
                    if (code !== 0) {
                        reject(new Error(`Worker stopped with exit code ${code}`));
                    }
                });
    
                worker.postMessage({
                    text,
                    inputLang: this.inputLang.translator_code,
                    outputLang: this.outputLang.translator_code,
                });
            } catch (error) {
                reject(error);
            }
        });
    }

    async _synthesizeSpeech(text) {
        console.log("Generating audio from translated text...");

        // Use getAllAudioUrls which splits the text into chunks and returns multiple URLs
        const audioUrls = getAllAudioUrls(text, {
            lang: this.outputLang.translator_code,
            slow: false,
        });

        // Download all audio chunks and store them in an array of buffers
        const audioBuffers = [];
        for (const urlInfo of audioUrls) {
            try {
                const response = await axios({
                    method: 'get',
                    url: urlInfo.url,
                    responseType: 'arraybuffer'
                });
                audioBuffers.push(Buffer.from(response.data));
            } catch (error) {
                console.error(`Failed to download audio chunk: ${urlInfo.url}`, error);
                throw new Error('Failed to download audio chunks for speech synthesis.');
            }
        }

        // Concatenate all buffers into a single buffer and write to the output file
        const combinedBuffer = Buffer.concat(audioBuffers);
        await fsPromises.writeFile(this.outputFilePath, combinedBuffer);
    }

    _speedUpAudio() {
        return new Promise((resolve, reject) => {
            console.log("Speeding up audio to 1.25x...");
            const tempPath = path.join(this.outputDir, `temp_${this.outputName}.mp3`);
            ffmpeg(this.outputFilePath)
                .audioFilter('atempo=1.25')
                .on('error', (err) => reject(new Error(`FFmpeg speed-up error: ${err.message}`)))
                .on('end', () => fsPromises.rename(tempPath, this.outputFilePath).then(resolve).catch(reject))
                .save(tempPath);
        });
    }
}

// --- EXAMPLE USAGE ---
async function main() {
    const options = {
        inputFile: 'C:\\Users\\YourUser\\Desktop\\test-audio-short.opus', // <-- CHANGE THIS
        inputLang: 'english',
        outputLang: 'french',
        outputDir: 'C:\\Users\\YourUser\\Desktop', // <-- CHANGE THIS
    };
    try {
        const isAccelerated = await AudioTranslator.checkHardware();
        if (!isAccelerated) {
            console.warn("WARNING: No GPU acceleration detected. Processing will be slow.");
        }
        const translator = new AudioTranslator(options);
        const results = await translator.process();
        console.log("\n--- Translation Complete ---");
        console.log("Original:", results.originalText);
        console.log("Translated:", results.translatedText);
        console.log("File saved to:", results.outputFilePath);
    } catch (e) {
        console.error("Main process failed:", e.message);
    }
}

module.exports = AudioTranslator;