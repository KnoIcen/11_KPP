const { writeFile } = require('fs');
const { pathToFileURL } = require('url');
const { desktopCapturer, Menu, dialog } = require('@electron/remote');

const videoElement = document.querySelector('video');
const videoSelectBtn = document.getElementById('videoSelectBtn');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const openBtn = document.getElementById('openBtn');

let mediaRecorder;
const recordedChunks = [];

videoSelectBtn.onclick = async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 0, height: 0 },
    });

    if (!sources.length) return;

    const template = sources.map((source) => ({
      label: source.name,
      click: () => selectSource(source),
    }));

    Menu.buildFromTemplate(template).popup();
  } catch (err) {
    console.error(err);
  }
};

async function selectSource(source) {
  videoSelectBtn.innerText = source.name;

  const constraints = {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: 'desktop',
        chromeMediaSourceId: source.id,
      },
    },
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoElement.srcObject = stream;
    await videoElement.play();

    recordedChunks.length = 0;

    const options = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options.mimeType = 'video/webm';
    }

    mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorder.ondataavailable = handleDataAvailable;
    mediaRecorder.onstop = handleStop;
  } catch (err) {
    console.error(err);
  }
}

startBtn.onclick = () => {
  if (!mediaRecorder) return;
  mediaRecorder.start();
  startBtn.classList.add('is-danger');
  startBtn.innerText = 'Запись';
};

stopBtn.onclick = () => {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  startBtn.classList.remove('is-danger');
  startBtn.innerText = 'Старт';
};

openBtn.onclick = async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Video', extensions: ['webm', 'mp4'] }],
  });

  if (canceled || !filePaths.length) return;

  if (videoElement.srcObject) {
    videoElement.srcObject.getTracks().forEach((track) => track.stop());
    videoElement.srcObject = null;
  }

  videoElement.src = pathToFileURL(filePaths[0]).href;
  videoElement.play();
};

function handleDataAvailable(e) {
  if (e.data.size > 0) {
    recordedChunks.push(e.data);
  }
}

async function handleStop() {
  const blob = new Blob(recordedChunks, {
    type: 'video/webm; codecs=vp9',
  });

  const buffer = Buffer.from(await blob.arrayBuffer());

  const { canceled, filePath } = await dialog.showSaveDialog({
    buttonLabel: 'Save video',
    defaultPath: `vid-${Date.now()}.webm`,
    filters: [{ name: 'WebM', extensions: ['webm'] }],
  });

  if (canceled || !filePath) return;

  writeFile(filePath, buffer, () => {
    console.log('video saved successfully!');
  });
}
