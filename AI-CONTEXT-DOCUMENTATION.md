# P2P Items List Application - Technical Documentation

## Overview
A serverless peer-to-peer collaborative items list application built with SvelteKit, WebRTC, and IndexedDB. Enables real-time collaboration between multiple devices without requiring a central server.

## Deployment
- **Production URL**: https://pos.mk313.com
- **Server**: IIS on Windows machine
- **Build Output**: Static files in `/build` directory
- **Local Development**: `npm run dev` (http://localhost:5173)

## Architecture

### Core Technologies
- **Frontend**: SvelteKit with TypeScript (strict mode)
- **Styling**: TailwindCSS
- **P2P Communication**: WebRTC DataChannels
- **Local Storage**: IndexedDB
- **QR Codes**: `qrcode` library for generation, `@zxing/library` for scanning
- **Data Compression**: `lz-string` for connection data
- **Build System**: Vite with `@sveltejs/adapter-static`

### Project Structure
```
src/
├── routes/
│   └── +page.svelte          # Main application UI
├── lib/
│   ├── p2p/
│   │   ├── webrtc-simple.ts  # WebRTC connection management
│   │   └── signaling.ts      # Connection code generation/storage
│   ├── state/
│   │   ├── items.ts          # Item management + IndexedDB
│   │   └── peers.ts          # Peer state management
│   ├── qr/
│   │   ├── generate.ts       # QR code generation
│   │   └── scan.ts           # QR code scanning with ZXing
│   ├── ui/
│   │   └── Toast.svelte      # Toast notifications
│   └── build-info.ts         # Auto-generated build metadata
```

## P2P Connection System

### Simple 4-Character Connection Flow
1. **Host Creates Connection**:
   - Generates 4-character code (e.g., "AB12")
   - Creates WebRTC offer and stores in temporary Map
   - Displays QR code containing the 4-character ID
   - Starts auto-polling for answers every 2 seconds

2. **Client Joins**:
   - Scans QR code or enters 4-character code manually
   - Retrieves stored offer from temporary storage
   - Creates WebRTC answer and stores it for host
   - Connection establishes automatically

3. **Data Synchronization**:
   - All item changes broadcast to connected peers
   - Conflict resolution based on `updatedAt` timestamps
   - Full sync requested when new peers connect

### WebRTC Implementation (`webrtc-simple.ts`)
- **ICE Servers**: Google STUN servers for NAT traversal
- **Data Channels**: Ordered, reliable communication
- **Multi-peer Support**: Star topology with host managing connections
- **Automatic Reconnection**: Handles peer disconnections gracefully

### Signaling System (`signaling.ts`)
- **Temporary Storage**: In-memory Map for connection offers/answers
- **4-Character IDs**: Human-readable connection codes
- **Auto Expiry**: Connections expire after 10 minutes
- **Compression**: LZ-string compression for large SDP payloads
- **Fallback**: Direct SDP exchange for manual connections

## Data Management

### Items Store (`items.ts`)
- **IndexedDB**: Persistent local storage with `p2p-items-db` database
- **Conflict Resolution**: Latest `updatedAt` timestamp wins
- **Tombstone Records**: Soft delete with `deleted: true` flag
- **Real-time Sync**: Changes broadcast immediately to all peers

### Item Structure
```typescript
interface Item {
  id: string;           // UUID or random string
  text: string;         // Item content
  updatedAt: string;    // ISO timestamp for conflict resolution
  deleted?: boolean;    // Tombstone for deleted items
  author?: string;      // Optional author identification
}
```

### Peer Management (`peers.ts`)
- **Peer Tracking**: Connection status and last seen timestamps
- **UI Updates**: Reactive Svelte store for connection display
- **Cleanup**: Automatic removal of disconnected peers

## QR Code System

### Generation (`qr/generate.ts`)
- **Primary**: `qrcode` library with canvas rendering
- **Fallback**: External QR service for error cases
- **Styling**: Dark/light color scheme for visibility

### Scanning (`qr/scan.ts`)
- **Library**: `@zxing/library` for reliable scanning
- **UI**: Modal overlay with video preview
- **Camera**: Prefers rear camera (`facingMode: 'environment'`)
- **Error Handling**: Graceful camera access failures

## User Interface

### Main Components
- **Connection Panel**: Host/join options with QR display
- **Items List**: Real-time collaborative item management
- **Peer Status**: Connected device display
- **Manual Fallbacks**: Text input for connection codes

### Responsive Design
- **Mobile First**: Touch-friendly QR scanning
- **Desktop Support**: Manual code entry options
- **Accessibility**: Proper form labels and keyboard navigation

## Build System

### Development
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

### Build Process
1. **Pre-build**: Auto-generate `build-info.ts` with version/timestamp
2. **Vite Build**: Compile TypeScript, process Svelte components
3. **Static Adapter**: Generate static files for IIS deployment
4. **Output**: `/build` directory ready for web server

### Dependencies
```json
{
  "@sveltejs/adapter-static": "^3.0.5",
  "@sveltejs/kit": "^2.8.0",
  "@zxing/library": "^0.21.3",
  "lz-string": "^1.5.0",
  "qrcode": "^1.5.4",
  "svelte": "^5.1.9",
  "tailwindcss": "^3.4.13",
  "typescript": "^5.6.3",
  "vite": "^7.1.3"
}
```

## Key Features

### Real-time Collaboration
- **Instant Sync**: Item changes appear on all devices immediately
- **Multi-device**: Unlimited concurrent connections
- **Offline Capable**: Works without internet after initial connection
- **Conflict Resolution**: Automatic handling of simultaneous edits

### User Experience
- **One-scan Connection**: QR scan → instant collaboration
- **Simple Codes**: 4-character IDs easy to share verbally
- **Auto-discovery**: Host automatically accepts new connections
- **Status Feedback**: Clear connection state indicators

### Technical Reliability
- **NAT Traversal**: STUN servers handle network restrictions
- **Resource Cleanup**: Proper camera/connection management
- **Error Recovery**: Graceful handling of connection failures
- **Data Persistence**: IndexedDB survives browser restarts

## Troubleshooting

### Common Issues
1. **QR Scan Fails**: Use manual 4-character code entry
2. **Connection Timeout**: Codes expire after 10 minutes
3. **Camera Access**: Requires HTTPS for camera permissions
4. **Network Issues**: STUN servers help with NAT/firewall

### Debug Features
- **Console Logging**: Detailed WebRTC connection logs
- **Build Info**: Version/timestamp in UI footer
- **Connection Status**: Real-time peer count display

## Security Considerations
- **No Server**: Data stays between connected devices only
- **Local Storage**: Items stored in browser's IndexedDB
- **Temporary Signaling**: Connection codes expire automatically
- **HTTPS Required**: Secure context needed for camera/WebRTC

## Recent Updates - January 2025

### Enhanced Build Version System (Latest)
**Enhancement**: Implemented comprehensive build tracking for accurate deployment verification.

**New Features**:
- Detailed build information with Git commit, branch, and dirty status
- Human-readable version format: `v0.0.1.1757722434 (03b9516)`
- Build environment details (Node version, platform, build host/user)
- Clickable build info in UI header with expandable detailed view
- Global debug functions: `buildInfo`, `getBuildSummary()`, `getDetailedBuildInfo()`
- Automatic generation via `scripts/generate-build-info.cjs`

**Files Modified**: 
- `package.json` - Updated prebuild script
- `scripts/generate-build-info.cjs` - New comprehensive build info generator
- `src/lib/build-info.ts` - Enhanced with TypeScript interface and helper functions
- `src/routes/+page.svelte` - Improved build display with detailed view

**Benefits**: Easy verification of deployed versions, better debugging, and deployment tracking

### P2P Connection Storage Fix
**Problem**: "Connection ID not found or expired" errors due to in-memory Map storage being lost on page reload/browser tabs.

**Solution**: Migrated to localStorage-based persistent storage with:
- SSR compatibility guards (`typeof window === 'undefined'`)
- 30-minute expiry system with automatic cleanup
- Enhanced debugging with `debugP2PConnections()` global function
- Comprehensive error logging and fallback handling

**Files Modified**: `src/lib/p2p/signaling.ts` - Complete storage layer rewrite
**Testing Status**: ✅ Build successful, SSR compatible, localStorage persistent storage working

### QR Scanning Improvements
**Problem**: jsQR library had reliability issues with camera scanning
**Solution**: Upgraded to ZXing library for better QR code detection
**Files**: `src/lib/qr/scan.ts`

### Connection System Simplification
**Problem**: Long SDP strings were unwieldy for QR codes
**Solution**: 4-character connection IDs (e.g. "AB12") with temporary storage
**Files**: `src/lib/p2p/signaling.ts`, `src/lib/p2p/webrtc-simple.ts`

## Future Enhancements
- **Persistent Signaling**: ✅ COMPLETED - Now using localStorage instead of in-memory storage
- **User Authentication**: Add optional user identification
- **End-to-end Encryption**: Encrypt item data before transmission
- **Advanced Conflict Resolution**: Handle complex merge scenarios

## Development Notes
- **SvelteKit 5**: Uses latest Svelte version with runes
- **TypeScript Strict**: Full type safety enabled
- **Static Generation**: No server-side rendering required
- **IIS Deployment**: Static files served directly by IIS

This documentation should provide complete context for any AI agent working on this application in the future, eliminating the need to reverse-engineer the architecture and features repeatedly.