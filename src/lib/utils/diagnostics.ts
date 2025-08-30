export function runDiagnostics() {
  console.log('Diagnostics:');
  console.log('QRCode:', typeof (window as any).QRCode !== 'undefined');
  console.log('jsQR:', typeof (window as any).jsQR !== 'undefined');
  console.log('Html5Qrcode:', typeof (window as any).Html5Qrcode !== 'undefined');
  console.log('LZString:', typeof (window as any).LZString !== 'undefined');
  try { console.log('IndexedDB available:', typeof indexedDB !== 'undefined'); } catch(e) {}
  return true;
}
