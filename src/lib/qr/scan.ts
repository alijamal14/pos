import { BrowserQRCodeReader } from '@zxing/library';

export async function startScanner(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const container = document.createElement('div');
    container.style.cssText = `
      background: white;
      padding: 20px;
      border-radius: 10px;
      text-align: center;
      max-width: 400px;
      width: 90%;
    `;

    const video = document.createElement('video');
    video.style.cssText = `
      width: 100%;
      max-width: 300px;
      height: 300px;
      object-fit: cover;
      border-radius: 8px;
      background: #f0f0f0;
    `;

    const status = document.createElement('p');
    status.textContent = 'Starting camera...';
    status.style.marginTop = '10px';

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      margin-top: 15px;
      padding: 8px 16px;
      background: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    `;

    container.appendChild(video);
    container.appendChild(status);
    container.appendChild(cancelBtn);
    modal.appendChild(container);
    document.body.appendChild(modal);

    const reader = new BrowserQRCodeReader();
    let scanning = true;

    const cleanup = () => {
      scanning = false;
      reader.reset();
      document.body.removeChild(modal);
    };

    cancelBtn.onclick = () => {
      cleanup();
      reject(new Error('Scan cancelled'));
    };

    // Start scanning
    reader.decodeFromVideoDevice(null, video, (result, error) => {
      if (!scanning) return;

      if (result) {
        status.textContent = 'QR Code detected!';
        cleanup();
        resolve(result.getText());
      } else if (error) {
        // Update status but continue scanning
        status.textContent = 'Scanning for QR code...';
      }
    }).catch((err) => {
      status.textContent = 'Camera error: ' + err.message;
      setTimeout(() => {
        cleanup();
        reject(err);
      }, 3000);
    });
  });
}
