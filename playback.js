
window.electronAPI.on('set-audio-path', (filePath) => {
    const audioPlayer = document.getElementById('audio-player');
    audioPlayer.src = filePath;
    audioPlayer.play();
});

document.getElementById('close-button').addEventListener('click', () => {
    window.electronAPI.closePlaybackWindow();
});
