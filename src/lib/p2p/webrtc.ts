export async function createAnswerAndLocalize(offerSDP: RTCSessionDescriptionInit) {
  try {
    // Find the most recent peer (created for offer), or create one if none exists
    const m = getPeerMap();
    let last = Array.from(m.values()).at(-1);

    // If no peer connection exists, create one (for joining devices)
    if (!last) {
      console.log('No existing peer connection found, creating new one for answer...');
      const { id, pc } = await newPeer();
      last = { pc, dc: null };
      // Note: We don't create a data channel here because the offerer already created one
    }

    const pc = last.pc;
    console.log('Setting remote description...', offerSDP.type);

    await pc.setRemoteDescription(offerSDP);
    console.log('Creating answer...');

    const answer = await pc.createAnswer();
    console.log('Setting local description...');

    await pc.setLocalDescription(answer);
    console.log('Waiting for ICE gathering...');

    await waitForIceGathering(pc);
    console.log('Answer created successfully');

    return pc.localDescription;
  } catch (error) {
    console.error('Answer creation failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create answer: ${errorMessage}`);
  }
}

export async function applyRemoteAnswer(answerSDP: RTCSessionDescriptionInit) {
  const m = getPeerMap();
  const last = Array.from(m.values()).at(-1);
  if (!last) throw new Error('No pending peer');
  const pc = last.pc;
  await pc.setRemoteDescription(answerSDP);
}
import { applyOp } from '$lib/state/items';
import { writable } from 'svelte/store';

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

  pc.ondatachannel = (e) => {
    dc = e.channel;
    setupDC(dc, id);
  };

  pc.oniceconnectionstatechange = () => {
    // update peers store
    peers.update(m => m);
  };

  const entry = { pc, dc };
  peers.update(m => { m.set(id, entry); return m; });

  return { id, pc, setDC: (d: RTCDataChannel) => { dc = d; setupDC(d, id); } };
}

function setupDC(dc: RTCDataChannel, id: string) {
  dc.binaryType = 'arraybuffer';
  dc.onopen = () => { console.log('DC open', id); }
  dc.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'op') {
        applyOp(msg.op);
      }
    } catch (e) { console.error('Bad message', e); }
  }
  dc.onclose = () => { peers.update(m => { m.delete(id); return m; }); }
}

export function broadcast(obj: any) {
  const m = getPeerMap();
  const data = JSON.stringify(obj);
  for (const [id, { dc }] of m) {
    if (dc && dc.readyState === 'open') dc.send(data);
  }
}

export function getPeerMap() {
  let v: Map<string, { pc: RTCPeerConnection, dc: RTCDataChannel | null }> = new Map();
  peers.subscribe(x => v = x)();
  return v;
}

export async function createOfferAndLocalize() {
  const { id, pc } = await newPeer();
  const dc = pc.createDataChannel('data');
  setupDC(dc, id);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  await waitForIceGathering(pc);
  return pc.localDescription;
}

export async function waitForIceGathering(pc: RTCPeerConnection, timeout = 3000) {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const handler = () => { if (pc.iceGatheringState === 'complete') { pc.removeEventListener('icegatheringstatechange', handler); resolve(); } };
    pc.addEventListener('icegatheringstatechange', handler);
    setTimeout(() => resolve(), timeout);
  });
}
