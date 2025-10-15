class TranslationResults {
    /**
     * @param {string} originalText The text transcribed from the source audio.
     * @param {string} translatedText The translated text.
     * @param {string} outputFilePath The full path to the final, translated audio file.
     */
    constructor(originalText, translatedText, outputFilePath) {
        this.originalText = originalText;
        this.translatedText = translatedText;
        this.outputFilePath = outputFilePath;
    }
}

module.exports = TranslationResults;