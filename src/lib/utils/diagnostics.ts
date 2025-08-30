export function runDiagnostics() {
  console.log('=== P2P Web App Diagnostics ===');

  // QR and compression libraries
  console.log('📱 QRCode available:', typeof (window as any).QRCode !== 'undefined');
  console.log('📷 jsQR available:', typeof (window as any).jsQR !== 'undefined');
  console.log('📷 Html5Qrcode available:', typeof (window as any).Html5Qrcode !== 'undefined');
  console.log('🗜️ LZString available:', typeof (window as any).LZString !== 'undefined');

  // Storage
  try {
    console.log('💾 IndexedDB available:', typeof indexedDB !== 'undefined');
  } catch(e) {
    console.log('💾 IndexedDB error:', e);
  }

  // WebRTC
  console.log('🔗 WebRTC available:', typeof RTCPeerConnection !== 'undefined');
  console.log('📡 DataChannel available:', typeof RTCDataChannel !== 'undefined');

  // Test WebRTC peer connection
  try {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ]
    });
    console.log('🔗 WebRTC peer connection created successfully');
    pc.close();
  } catch (e) {
    console.log('🔗 WebRTC peer connection failed:', e);
  }

  // Network information
  console.log('🌐 Online status:', navigator.onLine);
  console.log('🔒 Protocol:', location.protocol);
  console.log('🌍 Hostname:', location.hostname);

  // Permissions
  if ('permissions' in navigator) {
    navigator.permissions.query({ name: 'camera' as PermissionName }).then(result => {
      console.log('📷 Camera permission:', result.state);
    }).catch(e => console.log('📷 Camera permission check failed:', e));

    navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
      console.log('🎤 Microphone permission:', result.state);
    }).catch(e => console.log('🎤 Microphone permission check failed:', e));
  }

  console.log('=== End Diagnostics ===');
  return true;
}
