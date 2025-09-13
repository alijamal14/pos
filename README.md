# P2P Items List

A serverless peer-to-peer collaborative items list application. Connect multiple devices instantly via QR codes for real-time collaboration without any central server.

## 🌐 Live Demo
**Production URL**: https://pos.mk313.com

## ✨ Features

- **One-Scan Connection**: Scan QR code → instant collaboration
- **4-Character Codes**: Simple codes like "AB12" for easy sharing
- **Real-time Sync**: Changes appear on all devices immediately
- **Offline Capable**: Works without internet after initial connection
- **Multi-device**: Unlimited concurrent connections
- **No Server Required**: Pure P2P using WebRTC

## 🚀 Quick Start

### Development
```bash
npm install
npm run dev
```
Visit http://localhost:5173

### Production Build
```bash
npm run build     # Automatically generates detailed build info
```
Deploy the `build/` directory to any web server.

**Build Information**: Each build includes:
- Version with timestamp: `v0.0.1.1757722434`
- Git commit hash and branch information
- Build environment details
- Clickable build info in app header for verification

### IIS Deployment
1. Build the application: `npm run build`
2. Copy `build/` contents to IIS application directory
3. Ensure HTTPS is configured (required for camera/WebRTC)

## 🔧 How It Works

1. **Host** clicks "Host Connection" → gets 4-character code (e.g., "AB12")
2. **Client** scans QR code or enters the 4-character code manually
3. **Automatic Connection**: WebRTC establishes P2P connection
4. **Real-time Sync**: All changes broadcast to connected devices

## 🛠️ Build System

### Automatic Version Tracking
- Each build generates comprehensive version information
- Includes Git commit, branch, build time, and environment details
- Build info visible in app header (click to expand details)
- Global debug functions: `buildInfo`, `getBuildSummary()`, `getDetailedBuildInfo()`

### Debug Tools
- `debugP2PConnections()` - View stored connection data
- `debugP2PStorage()` - Test localStorage functionality
- Console logging for all P2P connection steps
4. **Real-time Sync**: All item changes sync instantly across devices

## 🏗️ Architecture

- **Frontend**: SvelteKit + TypeScript + TailwindCSS
- **P2P**: WebRTC DataChannels with STUN servers
- **Storage**: IndexedDB for local persistence
- **QR Codes**: `qrcode` + `@zxing/library` for scanning
- **Build**: Static site generation with Vite

## 📱 Device Support

- **Desktop**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Chrome Mobile, Samsung Internet
- **Requirements**: HTTPS for camera access, WebRTC support

## 🔒 Privacy

- **No Server**: Data stays between your devices only
- **Local Storage**: Items stored in your browser's IndexedDB
- **Temporary Codes**: Connection codes expire after 10 minutes
- **No Tracking**: No analytics, no external services

## 🛠️ Technical Details

For detailed technical documentation, architecture, and development context, see:
- [`AI-CONTEXT-DOCUMENTATION.md`](./AI-CONTEXT-DOCUMENTATION.md) - Complete technical reference

## 📋 Project Structure

```
src/
├── routes/+page.svelte           # Main UI
├── lib/
│   ├── p2p/
│   │   ├── webrtc-simple.ts     # WebRTC management
│   │   └── signaling.ts         # Connection codes
│   ├── state/
│   │   ├── items.ts             # Item management
│   │   └── peers.ts             # Peer tracking
│   ├── qr/                      # QR code generation/scanning
│   └── ui/                      # UI components
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on multiple devices
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

---

**Live Demo**: https://pos.mk313.com