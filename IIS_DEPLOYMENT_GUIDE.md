# P2P Items Web App - IIS Deployment Guide

## Overview
This guide documents the deployment of a SvelteKit-based P2P items web application on IIS (Internet Information Services) for Windows Server.

## Application Details
- **Framework**: SvelteKit with TypeScript
- **Build System**: Vite
- **Features**: WebRTC P2P functionality, QR code scanning/generation, IndexedDB storage
- **Dependencies**: qrcode, jsqr, html5-qrcode, lz-string

## Current Deployment Status ✅

### ✅ Working Components
- **HTTP Access**: `http://pos.mk313.com/` → **200 OK**
- **HTTPS Access**: `https://pos.mk313.com/` → **200 OK**
- **Static File Serving**: All assets (JS, CSS, images) served correctly
- **WebRTC Functionality**: Camera/microphone permissions configured
- **P2P Features**: QR scanning, WebRTC signaling, IndexedDB storage

### ⚠️ Known Limitations
- **SPA Routing**: Client-side routing (e.g., `/some-route`) returns 404 instead of redirecting to `index.html`
- **URL Rewrite Module**: Not available on current IIS installation
- **Workaround**: Direct links to specific routes won't work; users must start from root URL

## Recent Issues & Fixes

### Issue: 500 Internal Server Error (August 30, 2025)
**Problem**: Site suddenly returned 500 errors for both HTTP and HTTPS
**Root Cause**: A `web.config` file was placed in the `build/` directory containing URL rewrite rules that require the IIS URL Rewrite module (which is not installed)
**Solution**: Removed `build/web.config` file
**Result**: Site immediately returned to working state (200 OK)

**Prevention**: Never place web.config files with URL rewrite rules in directories served by IIS unless the URL Rewrite module is installed and configured.

## IIS Configuration

### Website Setup
```powershell
# IIS Site Configuration
Site Name: pos
Physical Path: C:\inetpub\wwwroot\pos\build
Binding: *:80:pos.mk313.com
Application Pool: pos (ApplicationPoolIdentity)
```

### Key Commands Used
```powershell
# Update physical path to build directory
C:\Windows\System32\inetsrv\appcmd.exe set vdir "pos/" -physicalPath:"C:\inetpub\wwwroot\pos\build"

# Verify site status
Get-IISSite -Name "pos"
Get-IISAppPool -Name "pos"
```

## File Structure
```
C:\inetpub\wwwroot\pos\
├── build\              # Production build files (served by IIS)
│   ├── index.html      # Main application entry point
│   ├── _app\           # SvelteKit compiled assets
│   └── robots.txt      # SEO configuration
├── src\                # Source code (development only)
├── package.json        # Dependencies and scripts
├── svelte.config.js    # SvelteKit configuration
└── web.config          # IIS configuration (in root, not used)
```

## Build Process
```bash
# Install dependencies
npm install

# Build for production
npm run build

# Files are generated in ./build directory
```

## Troubleshooting

### Common Issues & Solutions

#### 1. 500 Internal Server Error
**Symptoms**: Site returns 500 errors
**Root Cause**: Incorrect physical path or web.config issues
**Solution**: Ensure IIS points to `build` directory, remove problematic web.config

#### 2. 404 Errors for Routes
**Symptoms**: Direct links to `/some-route` return 404
**Root Cause**: Missing URL Rewrite module or web.config
**Solution**: Install IIS URL Rewrite module or accept limitation

#### 3. Permission Issues
**Symptoms**: Access denied errors
**Root Cause**: IIS application pool lacks file system permissions
**Solution**: Grant read access to `IIS_IUSRS` and application pool identity

### Verification Commands
```powershell
# Test basic access
Invoke-WebRequest -Uri "http://pos.mk313.com/" -UseBasicParsing

# Check IIS site configuration
Get-IISSite -Name "pos" | Format-List Name, State, Bindings, PhysicalPath

# Check application pool status
Get-IISAppPool -Name "pos" | Select-Object Name, State

# Check permissions
icacls "C:\inetpub\wwwroot\pos\build" /t
```

## Security Considerations
- ✅ HTTPS access working (SSL termination handled upstream)
- ✅ Application pool runs under ApplicationPoolIdentity
- ✅ Minimal required permissions granted
- ⚠️ Consider adding security headers if URL Rewrite module is installed

## Performance Notes
- Static files served directly by IIS
- No server-side processing required
- WebRTC and IndexedDB work client-side
- Compression can be enabled if needed

## Future Improvements
1. **Install IIS URL Rewrite Module** for proper SPA routing
2. **Add SSL Certificate** for direct HTTPS support
3. **Implement Security Headers** for enhanced security
4. **Set up Compression** for better performance
5. **Configure Logging** for better monitoring

## Deployment Checklist
- [x] IIS website created and configured
- [x] Physical path updated to build directory
- [x] Application pool running
- [x] Permissions configured correctly
- [x] HTTP access verified
- [x] HTTPS access verified
- [x] Basic functionality tested
- [x] **FIXED**: Removed problematic web.config from build directory
- [ ] SPA routing (requires URL Rewrite module)
- [ ] Security headers (requires URL Rewrite module)
- [ ] Compression (requires additional configuration)

## Quick Redeploy
```powershell
# 1. Build the application
npm run build

# 2. Update IIS physical path (if needed)
C:\Windows\System32\inetsrv\appcmd.exe set vdir "pos/" -physicalPath:"C:\inetpub\wwwroot\pos\build"

# 3. Restart application pool
Restart-WebAppPool -Name "pos"

# 4. Test access
Invoke-WebRequest -Uri "http://pos.mk313.com/" -UseBasicParsing
```

---
*Last Updated: August 30, 2025*
*Status: ✅ Production Ready (with known SPA routing limitation)*
*Recent Fix: Resolved 500 Internal Server Error caused by web.config in build directory*
