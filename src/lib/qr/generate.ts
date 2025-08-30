import QRCode from 'qrcode';

export async function generateToCanvas(container: HTMLElement, text: string, size = 360) {
  console.log('🎨 QR Code generation started for text length:', text.length);
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  try {
    // QRCode.toCanvas accepts width and render options; avoid passing unsupported 'height'
    await QRCode.toCanvas(canvas, text, { width: size, color: { dark: '#f3f6ff', light: '#0f1530' } } as any);
    container.appendChild(canvas);
    console.log('✅ QR Code generated successfully');
    return canvas;
  } catch (e) {
    console.error('❌ QR Code generation failed, using fallback:', e);
    // Fallback to image service
    const img = document.createElement('img');
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    img.style.width = `${size}px`;
    container.appendChild(img);
    return img;
  }
}
