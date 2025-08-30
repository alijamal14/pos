import { writable } from 'svelte/store';
export const peerCount = writable(0);
export const peerStatus = writable<'connected'|'disconnected'|'pending'>('disconnected');
