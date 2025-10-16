document.addEventListener('DOMContentLoaded', async () => {
    const fileDisplay = document.getElementById('file-display');
    const sourceLang = document.getElementById('source-lang');
    const destLang = document.getElementById('dest-lang');
    const submitBtn = document.getElementById('submit-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const outputContainer = document.getElementById('output-container');
    const appContainer = document.getElementById('app-container');
    const fileLabel = document.querySelector('.file-label');
    const transcriptionText = document.getElementById('transcription-text');
    const translationText = document.getElementById('translation-text');
    const resultsContainer = document.getElementById('results-container');
    const resetBtn = document.getElementById('reset-btn');

    resultsContainer.classList.add('greyed-out');
    
    let selectedFile = null;

    validateForm();

    fileLabel.addEventListener('click', () => {
        window.electronAPI.openFileDialog();
    });

    window.electronAPI.onFileSelected((file) => {
        selectedFile = file;
        if (selectedFile) {
            fileDisplay.innerHTML = `
                <span>${selectedFile.name}</span>
                <span class="remove-file-btn">X</span>
            `;
            fileDisplay.style.display = 'flex';
            fileLabel.textContent = 'Change Audio File';

            document.querySelector('.remove-file-btn').addEventListener('click', () => {
                selectedFile = null;
                window.electronAPI.clearFile();
                fileDisplay.style.display = 'none';
                fileDisplay.innerHTML = '';
                fileLabel.textContent = 'Select Audio File';
                validateForm();
            });
        }
        validateForm();
    });

    resetBtn.addEventListener('click', () => {
        selectedFile = null;
        window.electronAPI.clearFile();
        fileDisplay.style.display = 'none';
        fileDisplay.innerHTML = '';
        fileLabel.textContent = 'Select Audio File';
        transcriptionText.textContent = '';
        translationText.textContent = '';
        outputContainer.innerHTML = '';
        resultsContainer.classList.add('greyed-out');
        validateForm();
    });

    sourceLang.addEventListener('change', validateForm);
    destLang.addEventListener('change', validateForm);

    function validateForm() {
        const isFileSelected = selectedFile !== null;
        const isSourceLangSelected = sourceLang.value !== '';
        const isDestLangSelected = destLang.value !== '';
        const isFormValid = isFileSelected && isSourceLangSelected && isDestLangSelected;
        
        submitBtn.disabled = !isFormValid;
        resetBtn.disabled = !isFormValid;
    }

    submitBtn.addEventListener('click', () => {
        if (!selectedFile) return;

        const sourceLanguage = sourceLang.value;
        if (sourceLanguage === 'fr' || sourceLanguage === 'it') {
            alert('Translation for French and Italian is coming soon!');
            return;
        }

        // Disable UI and show spinner
        appContainer.classList.add('disabled');
        loadingSpinner.style.display = 'flex';
        outputContainer.innerHTML = '';
        transcriptionText.textContent = '';
        translationText.textContent = '';
        resultsContainer.classList.remove('greyed-out');

        window.electronAPI.translateAudio({
            sourceLang: sourceLang.value,
            destLang: destLang.value,
        });
    });

    window.electronAPI.onTranslationProgress((event) => {
        if (event.type === 'transcription') {
            transcriptionText.textContent = event.data;
        } else if (event.type === 'translation') {
            translationText.textContent = event.data;
        }
    });

    window.electronAPI.onTranslationComplete((outputPath) => {
        // Re-enable UI and hide spinner
        appContainer.classList.remove('disabled');
        loadingSpinner.style.display = 'none';

        outputContainer.innerHTML = `
            <span>Translated File:</span>
            <span class="file-path">${outputPath}</span>
            <button id="play-button" class="button">Play</button>
            <a href="#" id="open-folder-link">Open Folder</a>
        `;

        document.getElementById('play-button').addEventListener('click', () => {
            window.electronAPI.openPlaybackWindow(outputPath);
        });

        document.getElementById('open-folder-link').addEventListener('click', (e) => {
            e.preventDefault();
            window.electronAPI.openFileLocation(outputPath);
        });
    });

    window.electronAPI.onTranslationError((error) => {
        appContainer.classList.remove('disabled');
        loadingSpinner.style.display = 'none';
        outputContainer.innerHTML = `<span style="color: red;">Error: ${error}</span>`;
    });
});
