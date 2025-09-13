import { writable } from 'svelte/store';

export interface Peer {
  id: string;
  connected: boolean;
  lastSeen: number;
}

export const peersStore = writable<Record<string, Peer>>({});