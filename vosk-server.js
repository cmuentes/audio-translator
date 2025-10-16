const express = require('express');
const multer = require('multer');
const fs = require('fs');
const { Readable } = require('stream');
const vosk = require('vosk');
const path = require('path');

const app = express();
const port = 3000;

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// --- Vosk Model Loading ---
const modelPathEn = path.join(__dirname, 'node_modules', 'vosk-model-small-en-us-0.15');
const modelPathEs = path.join(__dirname, 'node_modules', 'vosk-model-small-es-0.42');

console.log("Looking for models in __dirname:", __dirname);
console.log("Checking for English model at:", modelPathEn);
console.log("Checking for Spanish model at:", modelPathEs);
console.log("English model exists:", fs.existsSync(modelPathEn));
console.log("Spanish model exists:", fs.existsSync(modelPathEs));

if (!fs.existsSync(modelPathEn) || !fs.existsSync(modelPathEs)) {
    console.error("Vosk models not found. Please make sure they are in the correct locations.");
    process.exit(1);
}

vosk.setLogLevel(0);
const modelEn = new vosk.Model(modelPathEn);
const modelEs = new vosk.Model(modelPathEs);


// --- Transcription Endpoint ---
app.post('/transcribe', upload.single('audio'), (req, res) => {
    const lang = req.body.lang;
    if (!lang) {
        return res.status(400).json({ error: 'Language not specified.' });
    }

    let model;
    if (lang === 'en') {
        model = modelEn;
    } else if (lang === 'es') {
        model = modelEs;
    } else {
        return res.status(400).json({ error: `Unsupported language: ${lang}` });
    }

    const recognizer = new vosk.Recognizer({ model: model, sampleRate: 16000 });
    const filePath = req.file.path;

    const audioStream = fs.createReadStream(filePath, { highWaterMark: 4096 });
    const readable = new Readable().wrap(audioStream);

    let fullText = '';

    readable.on('data', (chunk) => {
        if (recognizer.acceptWaveform(chunk)) {
            const result = recognizer.result();
            if (result.text) {
                fullText += result.text + ' ';
            }
        }
    });

    readable.on('end', () => {
        const finalResult = recognizer.finalResult();
        if (finalResult.text) {
            fullText += finalResult.text;
        }
        recognizer.free();
        
        // Clean up the uploaded file
        fs.unlinkSync(filePath);

        res.json({ transcription: fullText.trim() });
    });

    readable.on('error', (err) => {
        console.error('Stream error:', err);
        res.status(500).json({ error: 'Error processing audio stream.' });
        
        // Clean up the uploaded file
        fs.unlinkSync(filePath);
    });
});

app.listen(port, () => {
    console.log(`Vosk server listening on port ${port}`);
});
