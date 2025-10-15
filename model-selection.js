document.addEventListener('DOMContentLoaded', () => {
    const modelList = document.getElementById('model-list');
    const selectBtn = document.getElementById('select-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const downloadProgressContainer = document.getElementById('download-progress-container');
    const downloadStatus = document.getElementById('download-status');
    const progressBar = document.getElementById('progress-bar');
    const warningMessage = document.getElementById('warning-message');

    let cachedModels = [];
    let totalMemory = 0;

    const models = [
        { name: 'opus-mt-es-en', params: '~300 M', vram: '~500 MB', notes: 'Efficient and accurate Spanish-to-English translation.', level: 'easy', description: 'Based on the Opus-MT model by Helsinki-NLP.', ram: 1 },
    ];

    async function initializeModelList() {
        cachedModels = await window.electronAPI.getCachedModels();
        totalMemory = await window.electronAPI.getTotalMemory() / (1024 ** 3); // in GB

        models.forEach((model, index) => {
            const modelElement = document.createElement('div');
            modelElement.classList.add('model-item', `level-${model.level}`);
            const isCached = cachedModels.includes(model.name);
            
            // More conservative memory check: requires at least 1GB of buffer RAM.
            const hasEnoughMemory = (model.ram < totalMemory - 1);

            let disabledAttribute = '';
            let disabledClass = '';
            let description = model.description;
            
            if (!hasEnoughMemory) {
                disabledAttribute = 'disabled';
                disabledClass = 'disabled';
                description = `<span style="color: red;">Requires ${model.ram} GB RAM, but you only have ${totalMemory.toFixed(1)} GB available.</span>`;
            }

            modelElement.innerHTML = `
                <input type="radio" id="model-${model.name}" name="model" value="${model.name}" checked ${disabledAttribute}>
                <label for="model-${model.name}" class="${disabledClass}">
                    <div class="model-name">${model.name} ${isCached ? '(cached)' : ''}</div>
                    <div class="model-details">Parameters: ${model.params} | Est. VRAM: ${model.vram}</div>
                    <div class="model-description">${description}</div>
                    <div class="model-notes"><em>${model.notes}</em></div>
                </label>
            `;
            modelList.appendChild(modelElement);
        });
    }

    selectBtn.addEventListener('click', async () => {
        const selectedRadio = document.querySelector('input[name="model"]:checked');
        if (!selectedRadio) return;

        const selectedModel = selectedRadio.value;
        
        if (cachedModels.includes(selectedModel)) {
            window.electronAPI.modelSelected(selectedModel);
        } else {
            selectBtn.disabled = true;
            cancelBtn.disabled = true;
            downloadProgressContainer.style.display = 'block';
            await window.electronAPI.downloadModel(selectedModel);
        }
    });

    cancelBtn.addEventListener('click', () => {
        window.electronAPI.closeModelSelection();
    });

    window.electronAPI.onDownloadProgress((progress) => {
        if (typeof progress.progress === 'number') {
            const percentage = Math.round(progress.progress);
            downloadStatus.innerText = `Downloading ${progress.file}... ${percentage}%`;
            progressBar.style.width = `${percentage}%`;

            if (percentage === 100 && progress.file.includes('onnx')) {
                setTimeout(() => {
                    downloadStatus.innerText = 'Download complete. Finalizing...';
                    window.electronAPI.modelSelected(progress.model);
                }, 1000);
            }
        }
    });

    initializeModelList();
});
