document.addEventListener('DOMContentLoaded', async () => {
    const fileDisplay = document.getElementById('file-display');
    const sourceLang = document.getElementById('source-lang');
    const destLang = document.getElementById('dest-lang');
    const submitBtn = document.getElementById('submit-btn');
    const loadingSpinner = document.getElementById('loading-spinner');
    const outputContainer = document.getElementById('output-container');
    const appContainer = document.getElementById('app-container');
    const fileLabel = document.querySelector('.file-label');
    const gpuStatus = document.getElementById('gpu-status');
    const modelStatus = document.getElementById('model-status');
    const modelSelectBtn = document.getElementById('model-select-btn');
    const modelDetailsPanel = document.getElementById('model-details-panel');
    const selectedModelDisplay = document.getElementById('selected-model-display');

    let selectedFile = null;
    let selectedModel = null;

    // --- App Initialization ---
    try {
        const hasGpu = await window.electronAPI.checkHardware();
        gpuStatus.textContent = hasGpu
            ? 'GPU acceleration is available.'
            : 'GPU acceleration not available. Translation will be slower.';
        gpuStatus.style.color = hasGpu ? 'green' : 'orange';

        const cachedModels = await window.electronAPI.getCachedModels();
        if (cachedModels.length > 0) {
            selectedModel = cachedModels[0]; // Default to the first cached model
            modelStatus.textContent = `Using ${selectedModel}`;
            selectedModelDisplay.textContent = `(${selectedModel})`;
            modelDetailsPanel.open = false;
        } else {
            modelStatus.textContent = 'No local models found. Please select a model.';
            modelDetailsPanel.open = true;
        }
    } catch (error) {
        gpuStatus.textContent = 'Could not check for GPU acceleration.';
        modelStatus.textContent = 'Could not retrieve cached models.';
        console.error('Initialization error:', error);
    }
    
    validateForm();
    // --- End App Initialization ---

    modelSelectBtn.addEventListener('click', () => {
        window.electronAPI.openModelSelection();
    });

    window.electronAPI.onModelChosen((model) => {
        selectedModel = model;
        modelStatus.textContent = `Using ${selectedModel}`;
        selectedModelDisplay.textContent = `(${selectedModel})`;
        modelDetailsPanel.open = false;
        validateForm();
    });

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

    sourceLang.addEventListener('change', validateForm);
    destLang.addEventListener('change', validateForm);

    function validateForm() {
        const isFileSelected = selectedFile !== null;
        const isSourceLangSelected = sourceLang.value !== '';
        const isDestLangSelected = destLang.value !== '';
        const isModelSelected = selectedModel !== null;
        submitBtn.disabled = !(isFileSelected && isSourceLangSelected && isDestLangSelected && isModelSelected);
    }

    submitBtn.addEventListener('click', () => {
        if (!selectedFile) return;

        // Disable UI and show spinner
        appContainer.classList.add('disabled');
        loadingSpinner.style.display = 'flex';
        outputContainer.innerHTML = '';

        window.electronAPI.translateAudio({
            sourceLang: sourceLang.value,
            destLang: destLang.value,
            model: selectedModel
        });
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
        outputContainer.innerHTML = `<span style="color: red;">Error: ${errorMessage}</span>`;
    });
});
