
# P2P Items SvelteKit App

A local-first, peer-to-peer items list app using SvelteKit, TailwindCSS, TypeScript, WebRTC, and QR/manual signaling.

## Features
- Offline-first, IndexedDB storage
- Peer-to-peer sync via WebRTC (manual QR/copy-paste signaling)
- QR code generation and scanning (jsQR, html5-qrcode fallback)
- Diagnostics and debug tools
- Modular, strict TypeScript codebase
- Fully static build (adapter-static)

## Getting Started

```bash
npm install
npm run dev
```

## Build for Production

```bash
npm run build
npm run preview
```

## Testing

- Unit: `npm run test`
- E2E: `npx playwright test`

## Project Structure

- `src/lib/state/items.ts` — IndexedDB, items store, LWW merge
- `src/lib/p2p/webrtc.ts` — WebRTC, DataChannel, sync
- `src/lib/p2p/signaling.ts` — Offer/Answer encode/decode
- `src/lib/qr/generate.ts` — QR code generation
- `src/lib/qr/scan.ts` — QR scanning modal
- `src/lib/ui/Toast.svelte` — Toast notifications
- `src/lib/stores/peers.ts` — Peer status store
- `src/lib/utils/diagnostics.ts` — Diagnostics
- `src/routes/+page.svelte` — Main UI

## License
MIT
