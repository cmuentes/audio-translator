const { parentPort } = require('worker_threads');
const { translate } = require('@vitalets/google-translate-api');

process.on('uncaughtException', (err, origin) => {
    parentPort.postMessage({ status: 'error', output: `Worker uncaught exception: ${err.stack || err.message}` });
});

process.on('unhandledRejection', (reason, promise) => {
    const reasonMessage = reason.stack || String(reason) || 'An unknown rejection occurred';
    parentPort.postMessage({ status: 'error', output: `Worker unhandled rejection: ${reasonMessage}` });
});

async function doTranslate({ text, outputLang, inputLang }) {
    try {
        const { text: translatedText } = await translate(text, { to: outputLang, from: inputLang });
        parentPort.postMessage({ status: 'completed', output: translatedText });
    } catch (error) {
        parentPort.postMessage({ status: 'error', output: error.stack || error.message });
    }
}

parentPort.on('message', (message) => {
    doTranslate(message);
});
