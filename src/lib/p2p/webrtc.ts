import { applyOp, getCurrentItems, itemsStore, type Item } from '$lib/state/items';
import { writable } from 'svelte/store';
import { peerCount, peerStatus } from '$lib/stores/peers';

export const peers = writable<Map<string, { pc: RTCPeerConnection, dc: RTCDataChannel | null, remoteId?: string }>>(new Map());
export const allPeers = writable<Map<string, { id: string, isHost?: boolean, connectedAt?: number }>>(new Map());

let localPeerId: string | null = null;
export function setLocalPeerId(id: string) { localPeerId = id; }

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
    console.log(`📡 Data channel received for peer ${id}`);
    setupDC(dc, id);
    // Update peers store with the actual data channel
    peers.update(m => {
      const entry = m.get(id);
      if (entry) {
        entry.dc = dc;
      }
      return m;
    });
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`🔄 ICE connection state for ${id}: ${pc.iceConnectionState}`);
    // update peers store
    peers.update(m => m);
  };

  const entry = { pc, dc };
  peers.update(m => { m.set(id, entry); return m; });

  return {
    id,
    pc,
    setDC: (d: RTCDataChannel) => {
      dc = d;
      setupDC(d, id);
      // Update peers store with the actual data channel
      peers.update(m => {
        const entry = m.get(id);
        if (entry) {
          entry.dc = dc;
        }
        return m;
      });
    }
  };
}

function setupDC(dc: RTCDataChannel, id: string) {
  dc.binaryType = 'arraybuffer';
  dc.onopen = () => {
    console.log(`📡 Data channel opened for peer ${id} - Connection ready!`);
    peerStatus.set('connected');
    peerCount.update(c => c + 1);
    // Update peers store to trigger UI refresh
    peers.update(m => m);
    // Send our local peer id to the remote so the UI can show the real peer id
    try {
      if (localPeerId) {
        dc.send(JSON.stringify({ type: 'introduce', id: localPeerId }));
        // Ask the remote to send its full state so we can sync
        dc.send(JSON.stringify({ type: 'request_sync' }));
      }
    } catch (e) {
      console.error('Failed to send introduce/request_sync:', e);
    }
  };

  dc.onmessage = (ev) => {
    try {
      const msg = JSON.parse(ev.data);
      if (msg.type === 'op') {
        console.log(`📨 Received operation from peer ${id}:`, msg.op);
        applyOp(msg.op);
      } else if (msg.type === 'introduce') {
        console.log(`👋 Peer ${id} introduced itself as ${msg.id}`);
        // store the remote's peer id for UI
        peers.update(m => {
          const entry = m.get(id);
          if (entry) entry.remoteId = msg.id;
          return m;
        });
        // Add this peer to the network
        addPeerToNetwork(msg.id);
      } else if (msg.type === 'request_sync') {
        console.log(`🔁 Peer ${id} requested full sync`);
        // send full state
        try {
          const items = getCurrentItems();
          dc.send(JSON.stringify({ type: 'full_sync', items }));
        } catch (e) {
          console.error('Failed to send full_sync:', e);
        }
      } else if (msg.type === 'full_sync') {
        console.log(`🔁 Received full sync from peer ${id}`);
        // Merge all items from both peers, then update the store in a consistent order
        const remoteItems = msg.items || {};
        const localItems = getCurrentItems();
        // Merge: prefer the item with the latest updatedAt
        const merged: Record<string, Item> = { ...localItems };
        for (const it of Object.values(remoteItems) as Item[]) {
          const existing = merged[it.id];
          if (!existing || (existing.updatedAt || '') < (it.updatedAt || '')) {
            merged[it.id] = it;
          }
        }
        // Update the store with merged and sorted items
        const sorted = Object.values(merged).sort((a, b) => (a.updatedAt || '').localeCompare(b.updatedAt || ''));
        itemsStore.set(Object.fromEntries(sorted.map(it => [it.id, it])));
      } else if (msg.type === 'peer_list') {
        console.log(`📋 Received peer list from peer ${id}:`, msg.peers);
        // Update our local peer list
        allPeers.update(m => {
          // Clear existing peers and add the received list
          m.clear();
          for (const peer of msg.peers) {
            m.set(peer.id, peer);
          }
          return m;
        });
      } else if (msg.type === 'disconnect') {
        console.log(`🔌 Peer ${id} requested disconnect`);
        disconnectPeer(id);
      }
    } catch (e) {
      console.error(`❌ Failed to parse message from peer ${id}:`, e);
    }
  };

  dc.onclose = () => {
    console.log(`🔌 Data channel closed for peer ${id}`);
    const peerEntry = getPeerMap().get(id);
    if (peerEntry?.remoteId) {
      removePeerFromNetwork(peerEntry.remoteId);
    }
    peers.update(m => { m.delete(id); return m; });
    peerCount.update(c => Math.max(0, c - 1));
    if (getPeerMap().size === 0) {
      peerStatus.set('disconnected');
    }
  };

  dc.onerror = (error: any) => {
    console.error(`❌ Data channel error for peer ${id}:`, error);
  };
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
  let v: Map<string, { pc: RTCPeerConnection, dc: RTCDataChannel | null, remoteId?: string }> = new Map();
  peers.subscribe(x => v = x)();
  return v;
}

export function getAllPeers() {
  let v: Map<string, { id: string, isHost?: boolean, connectedAt?: number }> = new Map();
  allPeers.subscribe(x => v = x)();
  return v;
}

export function addPeerToNetwork(peerId: string, isHost = false) {
  allPeers.update(m => {
    m.set(peerId, { id: peerId, isHost, connectedAt: Date.now() });
    return m;
  });
  // Broadcast the updated peer list to all connected peers
  broadcastPeerList();
}

export function removePeerFromNetwork(peerId: string) {
  allPeers.update(m => {
    m.delete(peerId);
    return m;
  });
  // Broadcast the updated peer list to all connected peers
  broadcastPeerList();
}

export function broadcastPeerList() {
  const peerList = Array.from(getAllPeers().values());
  broadcast({ type: 'peer_list', peers: peerList });
}

export function disconnectPeer(peerId: string): boolean {
  console.log(`🔌 Disconnecting peer: ${peerId}`);
  const m = getPeerMap();

  // Find peer by remoteId or by peer connection ID
  let targetPeerId = null;
  let targetPeer = null;

  for (const [id, peer] of m) {
    if (peer.remoteId === peerId || id === peerId) {
      targetPeerId = id;
      targetPeer = peer;
      break;
    }
  }

  if (targetPeer) {
    try {
      // Close the data channel first
      if (targetPeer.dc && targetPeer.dc.readyState !== 'closed') {
        targetPeer.dc.close();
        console.log(`✅ Data channel closed for peer ${peerId}`);
      }

      // Close the peer connection
      if (targetPeer.pc && targetPeer.pc.connectionState !== 'closed') {
        targetPeer.pc.close();
        console.log(`✅ Peer connection closed for peer ${peerId}`);
      }

      // Remove from local peers map
      if (targetPeerId) {
        peers.update(p => {
          p.delete(targetPeerId);
          return p;
        });
      }

      // Remove from network peers
      removePeerFromNetwork(peerId);

      // Update peer count
      peerCount.update(c => Math.max(0, c - 1));

      // Update status if no peers left
      if (getPeerMap().size === 0) {
        peerStatus.set('disconnected');
      }

      console.log(`✅ Successfully disconnected peer: ${peerId}`);
      return true;
    } catch (error) {
      console.error(`❌ Error disconnecting peer ${peerId}:`, error);
      return false;
    }
  } else {
    console.warn(`⚠️ Peer ${peerId} not found for disconnection`);
    return false;
  }
}

export async function createOfferAndLocalize() {
  console.log('🏠 Creating offer (host mode)...');
  const { id, pc, setDC } = await newPeer();
  const dc = pc.createDataChannel('data');
  setDC(dc);

  // Add ourselves as the host to the network
  if (localPeerId) {
    addPeerToNetwork(localPeerId, true);
  }

  console.log('📡 Creating WebRTC offer...');
  const offer = await pc.createOffer();
  console.log('🔗 Setting local description...');
  await pc.setLocalDescription(offer);

  console.log('⏳ Waiting for ICE gathering...');
  await waitForIceGathering(pc);
  console.log('✅ Offer ready! Connection code generated.');
  return pc.localDescription;
}

export async function createAnswerAndLocalize(offerSDP: RTCSessionDescriptionInit) {
  try {
    console.log('🔗 Creating answer (join mode)...');

    // Always create a new peer for each joiner (supporting multiple peers)
    console.log('📱 Creating new peer connection for joining device...');
    const { id, pc } = await newPeer();

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

  // Find the most recent peer that doesn't have a remote description set yet
  // This handles the case where we have multiple peers waiting for answers
  let targetPeer = null;
  for (const [id, peer] of m) {
    if (peer.pc && !peer.pc.remoteDescription) {
      targetPeer = { id, peer };
      break;
    }
  }

  if (!targetPeer) {
    console.error('❌ No pending peer connection found for answer');
    throw new Error('No pending peer');
  }

  const { pc } = targetPeer.peer;
  console.log('📡 Setting remote answer description...');
  await pc.setRemoteDescription(answerSDP);
  console.log('✅ Remote answer applied successfully');
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
