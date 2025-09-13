import { encodeSDP, decodeSDP, storeConnectionOffer, getConnectionOffer, storeConnectionAnswer, getConnectionAnswer, isConnectionId } from './signaling';
import { peersStore, type Peer } from '../state/peers';
import { broadcast as broadcastItem } from '../state/items';

export interface WebRTCManager {
  createOffer: () => Promise<string>;
  acceptOffer: (codeOrSDP: string) => Promise<string>;
  handleAnswer: (codeOrSDP: string) => Promise<void>;
  checkForAnswer: (connectionId: string) => Promise<boolean>;
  broadcastToAllPeers: (data: any) => void;
  disconnect: () => void;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

class SimpleWebRTCManager implements WebRTCManager {
  private connections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  
  async createOffer(): Promise<string> {
    const peerId = this.generatePeerId();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    // Set up data channel as host
    const channel = pc.createDataChannel('items', {
      ordered: true
    });
    
    this.setupDataChannel(channel, peerId);
    this.setupPeerConnection(pc, peerId);
    this.connections.set(peerId, pc);
    this.dataChannels.set(peerId, channel);
    
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    // Wait for ICE gathering
    await this.waitForIceComplete(pc);
    
    // Store offer with simple ID instead of returning huge SDP
    const connectionId = storeConnectionOffer(pc.localDescription!);
    console.log('✅ Created connection ID:', connectionId);
    
    return connectionId;
  }
  
  async acceptOffer(codeOrSDP: string): Promise<string> {
    let offer: RTCSessionDescriptionInit;
    
    // Check if it's a simple connection ID or full SDP
    if (isConnectionId(codeOrSDP)) {
      console.log('🔗 Attempting to accept connection with ID:', codeOrSDP);
      console.log('🔗 Looking for stored offer...');
      
      const storedOffer = getConnectionOffer(codeOrSDP);
      if (!storedOffer) {
        console.error('❌ No stored offer found for ID:', codeOrSDP);
        console.log('🔍 Available storage keys:', Object.keys(localStorage).filter(k => k.startsWith('p2p_conn_')));
        throw new Error('Connection ID not found or expired');
      }
      
      console.log('✅ Found stored offer for ID:', codeOrSDP);
      offer = storedOffer;
    } else {
      offer = decodeSDP(codeOrSDP);
    }
    
    const peerId = this.generatePeerId();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    
    this.setupPeerConnection(pc, peerId);
    
    // Handle incoming data channel
    pc.addEventListener('datachannel', (event) => {
      this.setupDataChannel(event.channel, peerId);
      this.dataChannels.set(peerId, event.channel);
    });
    
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    // Wait for ICE gathering
    await this.waitForIceComplete(pc);
    
    this.connections.set(peerId, pc);
    
    // If it was a connection ID, store the answer for the host to pick up
    if (isConnectionId(codeOrSDP)) {
      storeConnectionAnswer(codeOrSDP, pc.localDescription!);
      console.log('✅ Stored answer for connection ID:', codeOrSDP);
      return `Answer stored for ${codeOrSDP}. Host will connect automatically.`;
    } else {
      // Return full SDP for manual exchange
      return encodeSDP(pc.localDescription!);
    }
  }
  
  async handleAnswer(codeOrSDP: string): Promise<void> {
    let answer: RTCSessionDescriptionInit;
    
    if (isConnectionId(codeOrSDP)) {
      throw new Error('Use checkForAnswer() method with connection IDs');
    } else {
      answer = decodeSDP(codeOrSDP);
    }
    
    // Find the peer connection that's waiting for an answer
    for (const [peerId, pc] of this.connections.entries()) {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(answer);
        console.log('✅ Answer applied to peer:', peerId);
        return;
      }
    }
    
    throw new Error('No peer connection waiting for answer');
  }
  
  async checkForAnswer(connectionId: string): Promise<boolean> {
    const answer = getConnectionAnswer(connectionId);
    if (!answer) {
      return false;
    }
    
    // Find the peer connection that's waiting for an answer
    for (const [peerId, pc] of this.connections.entries()) {
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(answer);
        console.log('✅ Auto-applied answer from connection ID:', connectionId);
        return true;
      }
    }
    
    return false;
  }
  
  private async waitForIceComplete(pc: RTCPeerConnection): Promise<void> {
    if (pc.iceGatheringState === 'complete') {
      return;
    }
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', onIceChange);
        resolve();
      }, 5000);
      
      const onIceChange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          pc.removeEventListener('icegatheringstatechange', onIceChange);
          resolve();
        }
      };
      
      pc.addEventListener('icegatheringstatechange', onIceChange);
    });
  }
  
  private setupPeerConnection(pc: RTCPeerConnection, peerId: string): void {
    pc.addEventListener('connectionstatechange', () => {
      console.log(`Peer ${peerId} state:`, pc.connectionState);
      
      if (pc.connectionState === 'connected') {
        peersStore.update((peers: Record<string, Peer>) => ({
          ...peers,
          [peerId]: { id: peerId, connected: true, lastSeen: Date.now() }
        }));
      } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.removePeer(peerId);
      }
    });
    
    pc.addEventListener('icegatheringstatechange', () => {
      console.log(`Peer ${peerId} ICE state:`, pc.iceGatheringState);
    });
  }
  
  private setupDataChannel(channel: RTCDataChannel, peerId: string): void {
    channel.addEventListener('open', () => {
      console.log('✅ Data channel opened with peer:', peerId);
      peersStore.update((peers: Record<string, Peer>) => ({
        ...peers,
        [peerId]: { id: peerId, connected: true, lastSeen: Date.now() }
      }));
      
      // Request full sync when connection is established
      setTimeout(() => {
        this.requestFullSync();
      }, 1000);
    });
    
    channel.addEventListener('close', () => {
      console.log('❌ Data channel closed with peer:', peerId);
      this.removePeer(peerId);
    });
    
    channel.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'item-sync') {
          console.log('📦 Received item sync from peer:', peerId, data);
          this.handleItemSync(data.payload);
        }
      } catch (error) {
        console.error('Failed to parse message from peer:', peerId, error);
      }
    });
  }
  
  private handleItemSync(payload: any): void {
    // Handle incoming item synchronization
    console.log('📦 Processing item sync:', payload);
    
    // Import the broadcast function dynamically to avoid circular imports
    import('../state/items').then(({ broadcast: broadcastItem }) => {
      if (payload.action === 'add' || payload.action === 'update') {
        // Apply the item update locally without broadcasting back
        broadcastItem(payload, false);
      } else if (payload.action === 'delete') {
        // Apply the item deletion locally without broadcasting back
        broadcastItem(payload, false);
      } else if (payload.action === 'full-sync') {
        // Handle full synchronization request
        this.handleFullSync(payload);
      }
    }).catch(console.error);
  }

  private async handleFullSync(payload: any): Promise<void> {
    try {
      const { getCurrentItems, itemsStore } = await import('../state/items');
      
      if (payload.requestSync) {
        // Another peer is requesting our full state
        const localItems = getCurrentItems();
        const nonDeletedItems = Object.values(localItems).filter(item => !item.deleted);
        
        this.broadcastToAllPeers({
          action: 'full-sync',
          items: nonDeletedItems,
          isResponse: true
        });
      } else if (payload.items && payload.isResponse) {
        // We're receiving full state from another peer
        const remoteItems = payload.items;
        const localItems = getCurrentItems();
        
        // Merge items - prefer the one with the latest updatedAt
        const merged = { ...localItems };
        for (const remoteItem of remoteItems) {
          const local = merged[remoteItem.id];
          if (!local || (local.updatedAt || '') < (remoteItem.updatedAt || '')) {
            merged[remoteItem.id] = remoteItem;
          }
        }
        
        itemsStore.set(merged);
        console.log('📦 Applied full sync from peer');
      }
    } catch (error) {
      console.error('❌ Failed to handle full sync:', error);
    }
  }
  
  public broadcastToAllPeers(data: any): void {
    const message = JSON.stringify({ type: 'item-sync', payload: data });
    
    for (const [peerId, channel] of this.dataChannels.entries()) {
      if (channel.readyState === 'open') {
        try {
          channel.send(message);
          console.log('✅ Broadcasted to peer:', peerId);
        } catch (error) {
          console.error('Failed to send to peer:', peerId, error);
        }
      }
    }
  }

  public requestFullSync(): void {
    console.log('📨 Requesting full sync from all peers');
    this.broadcastToAllPeers({
      action: 'full-sync',
      requestSync: true
    });
  }
  
  private removePeer(peerId: string): void {
    this.connections.delete(peerId);
    this.dataChannels.delete(peerId);
    
    peersStore.update((peers: Record<string, Peer>) => {
      const updated = { ...peers };
      delete updated[peerId];
      return updated;
    });
  }
  
  private generatePeerId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
  
  disconnect(): void {
    for (const [peerId, pc] of this.connections.entries()) {
      pc.close();
      this.removePeer(peerId);
    }
    this.connections.clear();
    this.dataChannels.clear();
  }
}

// Global instance
let webRTCManager: SimpleWebRTCManager | null = null;

export function getWebRTCManager(): SimpleWebRTCManager {
  if (!webRTCManager) {
    webRTCManager = new SimpleWebRTCManager();
  }
  return webRTCManager;
}