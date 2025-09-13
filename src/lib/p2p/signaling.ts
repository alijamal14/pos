import LZString from 'lz-string';

// Use localStorage for temporary storage (more persistent than in-memory Map)
const STORAGE_PREFIX = 'p2p_conn_';
const STORAGE_EXPIRY_KEY = 'p2p_cleanup_';

// Generate simple 4-character connection ID
function generateConnectionId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Store connection offer and return simple ID
export function storeConnectionOffer(sdp: RTCSessionDescriptionInit): string {
  const id = generateConnectionId();
  const data = {
    type: 'offer',
    sdp,
    timestamp: Date.now(),
    expires: Date.now() + 30 * 60 * 1000 // 30 minutes for better reliability
  };
  
  if (typeof window === 'undefined') {
    // SSR - can't use localStorage, return ID for client-side handling
    return id;
  }
  
  try {
    localStorage.setItem(STORAGE_PREFIX + id, JSON.stringify(data));
    localStorage.setItem(STORAGE_EXPIRY_KEY + Date.now(), id); // For cleanup
    cleanupExpired();
    console.log('📦 Stored offer with ID:', id, 'Data:', data);
    console.log('📦 Storage verification:', localStorage.getItem(STORAGE_PREFIX + id) ? 'SUCCESS' : 'FAILED');
    return id;
  } catch (error) {
    console.error('❌ Failed to store connection offer:', error);
    // Fallback to in-memory storage
    (window as any).tempStorage = (window as any).tempStorage || new Map();
    (window as any).tempStorage.set(id, data);
    return id;
  }
}

// Get connection offer by ID
export function getConnectionOffer(id: string): RTCSessionDescriptionInit | null {
  if (typeof window === 'undefined') {
    return null; // SSR - no client storage available
  }
  
  const key = STORAGE_PREFIX + id.toUpperCase();
  console.log('🔍 Looking for connection ID:', id, 'Key:', key);
  
  try {
    const stored = localStorage.getItem(key);
    console.log('🔍 Storage result:', stored ? 'FOUND' : 'NOT FOUND');
    
    if (!stored) {
      // Check fallback storage
      const fallback = (window as any).tempStorage?.get(id.toUpperCase());
      if (fallback && Date.now() <= fallback.expires) {
        console.log('✅ Found in fallback storage');
        return fallback.sdp;
      }
      console.log('❌ Connection ID not found in storage or fallback');
      return null;
    }
    
    const data = JSON.parse(stored);
    console.log('📦 Parsed data:', { type: data.type, expires: new Date(data.expires), now: new Date() });
    
    if (Date.now() > data.expires || data.type !== 'offer') {
      console.log('❌ Connection expired or wrong type');
      localStorage.removeItem(key);
      return null;
    }
    
    console.log('✅ Connection offer found and valid');
    return data.sdp;
  } catch (error) {
    console.error('❌ Error retrieving connection offer:', error);
    localStorage.removeItem(key);
    return null;
  }
}

// Store connection answer
export function storeConnectionAnswer(id: string, sdp: RTCSessionDescriptionInit): boolean {
  if (typeof window === 'undefined') {
    return false; // SSR - no client storage available
  }
  
  const offerKey = STORAGE_PREFIX + id.toUpperCase();
  const answerKey = STORAGE_PREFIX + id.toUpperCase() + '_ANS';
  
  try {
    // Check if the offer still exists
    const offerData = localStorage.getItem(offerKey);
    if (!offerData) {
      console.log('❌ Original offer not found for answer storage');
      return false;
    }
    
    const offer = JSON.parse(offerData);
    if (Date.now() > offer.expires) {
      console.log('❌ Original offer expired');
      localStorage.removeItem(offerKey);
      return false;
    }
    
    const answerData = {
      type: 'answer',
      sdp,
      timestamp: Date.now(),
      expires: Date.now() + 30 * 60 * 1000
    };
    
    localStorage.setItem(answerKey, JSON.stringify(answerData));
    console.log('📦 Stored answer for ID:', id);
    return true;
  } catch (error) {
    console.error('❌ Failed to store answer:', error);
    return false;
  }
}

// Get connection answer by ID
export function getConnectionAnswer(id: string): RTCSessionDescriptionInit | null {
  if (typeof window === 'undefined') {
    return null; // SSR - no client storage available
  }
  
  const answerKey = STORAGE_PREFIX + id.toUpperCase() + '_ANS';
  
  try {
    const stored = localStorage.getItem(answerKey);
    if (!stored) {
      return null;
    }
    
    const data = JSON.parse(stored);
    if (Date.now() > data.expires || data.type !== 'answer') {
      localStorage.removeItem(answerKey);
      return null;
    }
    
    // Remove the answer after retrieving it (one-time use)
    localStorage.removeItem(answerKey);
    console.log('✅ Retrieved and consumed answer for ID:', id);
    return data.sdp;
  } catch (error) {
    console.error('❌ Error retrieving answer:', error);
    return null;
  }
}

// Clean up expired entries
function cleanupExpired() {
  if (typeof window === 'undefined') {
    return; // SSR - no client storage available
  }
  
  try {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    // Clean up expired connections
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.expires && now > data.expires) {
            keysToDelete.push(key);
          }
        } catch (e) {
          keysToDelete.push(key); // Remove invalid entries
        }
      }
    }
    
    keysToDelete.forEach((key: string) => localStorage.removeItem(key));
    
    if (keysToDelete.length > 0) {
      console.log('🧹 Cleaned up expired connections:', keysToDelete.length);
    }
  } catch (error) {
    console.error('❌ Cleanup error:', error);
  }
}

// Debug function to list all stored connections
export function debugListConnections(): any[] {
  if (typeof window === 'undefined') {
    console.log('🔍 DEBUG: SSR mode - no localStorage available');
    return [];
  }
  
  console.log('🔍 DEBUG: All stored connections:');
  const connections: any[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        connections.push({
          key,
          type: data.type,
          expires: new Date(data.expires),
          expired: Date.now() > data.expires,
          timeLeft: Math.max(0, data.expires - Date.now())
        });
      } catch (e) {
        connections.push({ key, error: 'Invalid data' });
      }
    }
  }
  
  console.table(connections);
  return connections;
}

// Debug function to test connection storage
export function debugTestStorage(testId: string = 'TEST'): void {
  if (typeof window === 'undefined') {
    console.log('❌ DEBUG: SSR mode - cannot test storage');
    return;
  }
  
  console.log('🧪 Testing localStorage with ID:', testId);
  
  // Create a test offer
  const testOffer = {
    type: 'offer' as const,
    sdp: 'test-sdp-content'
  };
  
  // Store it
  const storedId = storeConnectionOffer(testOffer);
  console.log('📦 Stored test offer with ID:', storedId);
  
  // Try to retrieve it
  const retrieved = getConnectionOffer(storedId);
  console.log('📥 Retrieved offer:', retrieved);
  
  if (retrieved) {
    console.log('✅ Storage test PASSED');
  } else {
    console.log('❌ Storage test FAILED');
  }
  
  // Clean up
  if (typeof window !== 'undefined') {
    const key = STORAGE_PREFIX + storedId.toUpperCase();
    localStorage.removeItem(key);
    console.log('🧹 Cleaned up test data');
  }
}

// Make debug function available globally
if (typeof window !== 'undefined') {
  (window as any).debugP2PConnections = debugListConnections;
  (window as any).debugP2PStorage = debugTestStorage;
}

// Fallback: Direct SDP encoding for when you need to send the full SDP
export function encodeSDP(sdp: RTCSessionDescriptionInit): string {
  const payload = { type: sdp.type, sdp: sdp.sdp };
  const json = JSON.stringify(payload);
  
  // Try compression first
  try {
    const compressed = LZString.compressToBase64(json);
    if (compressed && compressed.length < json.length) {
      return 'LZ:' + compressed;
    }
  } catch (e) {
    console.warn('Compression failed, using base64');
  }
  
  return btoa(json);
}

export function decodeSDP(encoded: string): RTCSessionDescriptionInit {
  try {
    let json: string;
    
    if (encoded.startsWith('LZ:')) {
      // Decompress
      json = LZString.decompressFromBase64(encoded.substring(3)) || '';
      if (!json) throw new Error('Decompression failed');
    } else {
      // Regular base64
      json = atob(encoded);
    }
    
    const payload = JSON.parse(json);
    return {
      type: payload.type as RTCSdpType,
      sdp: payload.sdp
    };
  } catch (error) {
    throw new Error('Invalid SDP code');
  }
}

// Check if it's a simple connection ID (4 characters) vs full SDP
export function isConnectionId(code: string): boolean {
  return /^[A-Z0-9]{4}$/.test(code.toUpperCase());
}
