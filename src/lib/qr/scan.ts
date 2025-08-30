import jsQR from 'jsqr';

export async function startScanner(onResult: (text: string) => void) {
  // Create basic modal with video and scanning loop using jsQR
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;z-index:2000;';
  const box = document.createElement('div');
  box.style.cssText = 'background:#0f1530;padding:16px;border-radius:8px;text-align:center;min-width:320px;';
  const video = document.createElement('video');
  video.setAttribute('playsinline', '');
  video.style.width = '320px';
  video.style.borderRadius = '8px';
  box.appendChild(video);
  const status = document.createElement('div'); status.style.color = '#8aa0ff'; status.textContent = 'Starting camera...';
  box.appendChild(status);
  const btnClose = document.createElement('button'); btnClose.textContent = 'Cancel'; btnClose.style.marginTop = '8px';
  box.appendChild(btnClose);
  modal.appendChild(box);
  document.body.appendChild(modal);

  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    video.srcObject = stream;
    await video.play();
    status.textContent = 'Scanning...';
  } catch (e) {
    status.textContent = 'Camera failed: ' + (e as Error).message;
    return;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  let running = true;

  btnClose.onclick = () => { running = false; try { stream?.getTracks().forEach(t => t.stop()); } catch {} modal.remove(); };

  (async function loop(){
    if (!running) return;
    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      try {
        const imageData = ctx.getImageData(0,0,canvas.width,canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
        if (code && code.data) {
          onResult(code.data);
          running = false;
          try { stream?.getTracks().forEach(t => t.stop()); } catch {}
          modal.remove();
          return;
        }
      } catch (e) {}
    }
    requestAnimationFrame(loop);
  })();
}
