export async function createAnswerAndLocalize(offerSDP: RTCSessionDescriptionInit) {
  try {
    console.log('🔗 Creating answer (join mode)...');

    // Find the most recent peer (created for offer), or create one if none exists
    const m = getPeerMap();
    let last = Array.from(m.values()).at(-1);

    // If no peer connection exists, create one (for joining devices)
    if (!last) {
      console.log('📱 No existing peer connection found, creating new one for answer...');
      const { id, pc } = await newPeer();
      last = { pc, dc: null };
      // Note: We don't create a data channel here because the offerer already created one
    }

    const pc = last.pc;
    console.log('📡 Setting remote description...', offerSDP.type);

    await pc.setRemoteDescription(offerSDP);
    console.log('🔄 Creating answer...');

    const answer = await pc.createAnswer();
    console.log('🔗 Setting local description...');

    await pc.setLocalDescription(answer);
    console.log('⏳ Waiting for ICE gathering...');

    await waitForIceGathering(pc);
    console.log('✅ Answer created successfully! Connection code ready to share.');

    return pc.localDescription;
  } catch (error) {
    console.error('❌ Answer creation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create answer: ${errorMessage}`);
  }
}

export async function applyRemoteAnswer(answerSDP: RTCSessionDescriptionInit) {
  console.log('🔗 Applying remote answer...');
  const m = getPeerMap();
  const last = Array.from(m.values()).at(-1);
  if (!last) {
    console.error('❌ No pending peer connection found for answer');
    throw new Error('No pending peer');
  }
  const pc = last.pc;
  console.log('📡 Setting remote answer description...');
  await pc.setRemoteDescription(answerSDP);
  console.log('✅ Remote answer applied successfully');
}
import { applyOp } from '$lib/state/items';
import { writable } from 'svelte/store';
import { peerCount, peerStatus } from '$lib/stores/peers';

export const peers = writable<Map<string, { pc: RTCPeerConnection, dc: RTCDataChannel | null }>>(new Map());

const pcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

export async function newPeer() {
  const pc = new RTCPeerConnection(pcConfig);
  const id = Math.random().toString(36).slice(2,8);
  let dc: RTCDataChannel | null = null;

  console.log(`🔗 Peer created with ID: ${id}`);

  pc.ondatachannel = (e) => {
    dc = e.channel;
    setupDC(dc, id);
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`🔄 ICE connection state for ${id}: ${pc.iceConnectionState}`);
    // update peers store
    peers.update(m => m);
  };

  const entry = { pc, dc };
  peers.update(m => { m.set(id, entry); return m; });

  return { id, pc, setDC: (d: RTCDataChannel) => { dc = d; setupDC(d, id); } };
}

function setupDC(dc: RTCDataChannel, id: string) {
  dc.binaryType = 'arraybuffer';
  dc.onopen = () => {
    console.log(`📡 Data channel opened for peer ${id} - Connection ready!`);
    peerStatus.set('connected');
    peerCount.update(c => c + 1);
  }
  dc.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'op') {
        console.log(`📨 Received operation from peer ${id}:`, msg.op);
        applyOp(msg.op);
      }
    } catch (e) {
      console.error(`❌ Failed to parse message from peer ${id}:`, e);
    }
  }
  dc.onclose = () => {
    console.log(`🔌 Data channel closed for peer ${id}`);
    peers.update(m => { m.delete(id); return m; });
    peerCount.update(c => Math.max(0, c - 1));
    if (getPeerMap().size === 0) {
      peerStatus.set('disconnected');
    }
  }
}

export function broadcast(obj: any) {
  const m = getPeerMap();
  const data = JSON.stringify(obj);
  console.log(`📤 Broadcasting to ${m.size} peer(s):`, obj);
  for (const [id, { dc }] of m) {
    if (dc && dc.readyState === 'open') {
      console.log(`✅ Sending to peer ${id}`);
      dc.send(data);
    } else {
      console.log(`⚠️ Peer ${id} not ready (${dc?.readyState || 'no channel'})`);
    }
  }
}

export function getPeerMap() {
  let v: Map<string, { pc: RTCPeerConnection, dc: RTCDataChannel | null }> = new Map();
  peers.subscribe(x => v = x)();
  return v;
}

export async function createOfferAndLocalize() {
  console.log('🏠 Creating offer (host mode)...');
  const { id, pc } = await newPeer();
  const dc = pc.createDataChannel('data');
  setupDC(dc, id);

  console.log('📡 Creating WebRTC offer...');
  const offer = await pc.createOffer();
  console.log('🔗 Setting local description...');
  await pc.setLocalDescription(offer);

  console.log('⏳ Waiting for ICE gathering...');
  await waitForIceGathering(pc);
  console.log('✅ Offer ready! Connection code generated.');
  return pc.localDescription;
}

export async function waitForIceGathering(pc: RTCPeerConnection, timeout = 3000) {
  console.log('⏳ Starting ICE gathering...');
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      console.log('✅ ICE gathering already complete');
      return resolve();
    }
    const handler = () => {
      if (pc.iceGatheringState === 'complete') {
        console.log('✅ ICE gathering completed');
        pc.removeEventListener('icegatheringstatechange', handler);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', handler);
    setTimeout(() => {
      console.log('⏰ ICE gathering timeout reached');
      resolve();
    }, timeout);
  });
}
