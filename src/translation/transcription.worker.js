const { parentPort } = require('worker_threads');
const { pipeline } = require('@xenova/transformers');
const { WaveFile } = require('wavefile');
const fs = require('fs').promises;

process.on('uncaughtException', (err, origin) => {
    parentPort.postMessage({ status: 'error', output: `Worker uncaught exception: ${err.message}` });
});

process.on('unhandledRejection', (reason, promise) => {
    parentPort.postMessage({ status: 'error', output: `Worker unhandled rejection: ${reason}` });
});

async function transcribe({ filePath, model, inputLang }) {
    try {
        const transcriber = await pipeline('automatic-speech-recognition', `Xenova/whisper-${model}`);
        
        const wav = new WaveFile(await fs.readFile(filePath));
        wav.toBitDepth('32f');
        const audioData = wav.getSamples();

        const output = await transcriber(audioData, { language: inputLang });
        
        await transcriber.dispose();

        parentPort.postMessage({ status: 'completed', output: output.text });
    } catch (error) {
        parentPort.postMessage({ status: 'error', output: error.message });
    }
}

parentPort.on('message', (message) => {
    transcribe(message);
});
