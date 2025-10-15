const { parentPort } = require('worker_threads');
const { pipeline } = require('@xenova/transformers');

process.on('uncaughtException', (err, origin) => {
    parentPort.postMessage({ status: 'error', output: `Worker uncaught exception: ${err.stack || err.message}` });
});

process.on('unhandledRejection', (reason, promise) => {
    const reasonMessage = reason.stack || String(reason) || 'An unknown rejection occurred';
    parentPort.postMessage({ status: 'error', output: `Worker unhandled rejection: ${reasonMessage}` });
});

async function translate({ text, outputLang, inputLang }) {
    try {
        const translator = await pipeline('translation', 'Xenova/opus-mt-es-en', {
            device: 'cpu',
            quantized: false
        });

        const output = await translator(text, {
            tgt_lang: outputLang,
            src_lang: inputLang,
        });
        
        await translator.dispose();

        parentPort.postMessage({ status: 'completed', output: output[0].translation_text });
    } catch (error) {
        parentPort.postMessage({ status: 'error', output: error.stack || error.message });
    }
}

parentPort.on('message', (message) => {
    translate(message);
});
