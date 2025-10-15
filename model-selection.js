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
        { name: 'tiny', params: '~39 M', vram: '~1 GB', notes: 'Fastest, lowest accuracy.', level: 'easy', description: 'Recommended for most computers.', ram: 2 },
        { name: 'base', params: '~74 M', vram: '~1 GB', notes: 'Good balance of speed and accuracy.', level: 'easy', description: 'Slightly more accurate than Tiny.', ram: 2 },
        { name: 'small', params: '~244 M', vram: '~2 GB', notes: 'More accurate, requires more resources.', level: 'medium', description: 'Requires a modern computer.', ram: 4 },
        { name: 'medium', params: '~769 M', vram: '~5 GB', notes: 'High accuracy, resource-intensive.', level: 'hard', description: 'Requires a powerful computer with a dedicated GPU.', ram: 8 },
        { name: 'large', params: '~1550 M', vram: '~10 GB', notes: 'Highest accuracy, very resource-intensive.', level: 'expert', description: 'For high-end gaming or workstation PCs with a top-tier GPU.', ram: 16 }
    ];

    async function initializeModelList() {
        cachedModels = await window.electronAPI.getCachedModels();
        totalMemory = await window.electronAPI.getTotalMemory() / (1024 ** 3); // in GB

        models.forEach((model, index) => {
            const modelElement = document.createElement('div');
            modelElement.classList.add('model-item', `level-${model.level}`);
            const isCached = cachedModels.includes(model.name);
            modelElement.innerHTML = `
                <input type="radio" id="model-${model.name}" name="model" value="${model.name}" ${index === 0 ? 'checked' : ''}>
                <label for="model-${model.name}">
                    <div class="model-name">${model.name} ${isCached ? '(cached)' : ''}</div>
                    <div class="model-details">Parameters: ${model.params} | Est. VRAM: ${model.vram}</div>
                    <div class="model-description">${model.description}</div>
                    <div class="model-notes"><em>${model.notes}</em></div>
                </label>
            `;
            modelList.appendChild(modelElement);
        });

        document.querySelectorAll('input[name="model"]').forEach(radio => {
            radio.addEventListener('change', () => {
                const selectedModel = models.find(m => m.name === radio.value);
                if (selectedModel.ram > totalMemory) {
                    warningMessage.innerText = `Warning: This model requires at least ${selectedModel.ram} GB of RAM. Your system has ${totalMemory.toFixed(1)} GB. The app may crash if you proceed.`;
                    warningMessage.style.display = 'block';
                } else {
                    warningMessage.style.display = 'none';
                }
            });
        });
    }

    selectBtn.addEventListener('click', async () => {
        const selectedModel = document.querySelector('input[name="model"]:checked').value;
        
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
