# IIS Deployment Guide

## Current Production Setup
- **URL**: https://pos.mk313.com
- **Server**: Windows IIS
- **Application Directory**: `C:\inetpub\wwwroot\pos`
- **Build Output**: Static files in `/build` directory

## Deployment Steps

### 1. Build the Application
```powershell
cd C:\inetpub\wwwroot\pos
npm run build
```

### 2. IIS Configuration
The application is configured as an IIS application under the default website:
- **Application Name**: `pos`
- **Physical Path**: `C:\inetpub\wwwroot\pos\build`
- **Application Pool**: Uses DefaultAppPool or dedicated pool

### 3. Required IIS Features
Ensure these IIS features are enabled:
- Static Content
- Default Document
- HTTP Redirection (for SPA routing)

### 4. Web.config (for SPA Support)
The build process should generate a `web.config` in the build directory. If not, create one:

```xml
<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <system.webServer>
    <rewrite>
      <rules>
        <rule name="SPA fallback routing" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
          </conditions>
          <action type="Rewrite" url="/" />
        </rule>
      </rules>
    </rewrite>
    <staticContent>
      <mimeMap fileExtension=".js" mimeType="application/javascript" />
      <mimeMap fileExtension=".mjs" mimeType="application/javascript" />
    </staticContent>
  </system.webServer>
</configuration>
```

### 5. HTTPS Configuration
**Critical**: The application requires HTTPS for:
- Camera access (QR scanning)
- WebRTC functionality
- Secure context for modern web APIs

Ensure SSL certificate is properly configured in IIS.

### 6. Firewall Considerations
WebRTC uses STUN servers for NAT traversal:
- Outbound HTTPS (443) for STUN servers
- Random UDP ports for WebRTC data channels

### 7. Build Process Integration
For automated deployment, the build process:
1. Runs `prebuild` script to generate build info
2. Compiles TypeScript and Svelte components
3. Processes static assets
4. Outputs to `/build` directory ready for IIS

### 8. Verification Steps
After deployment:
1. Visit https://pos.mk313.com
2. Test "Host Connection" functionality
3. Test QR code scanning with mobile device
4. Verify real-time item synchronization
5. Check browser console for errors

## Troubleshooting

### Common Issues
- **Camera not working**: Ensure HTTPS is properly configured
- **WebRTC connection fails**: Check firewall settings for UDP traffic
- **Static files not loading**: Verify IIS static content handling
- **SPA routing issues**: Ensure web.config rewrite rules are active

### Log Locations
- IIS Logs: `C:\inetpub\logs\LogFiles`
- Browser Console: Check for JavaScript errors
- Network Tab: Monitor WebRTC connection attempts

## Maintenance

### Regular Tasks
1. **Updates**: Run `npm update` periodically for security updates
2. **Builds**: Rebuild after any code changes
3. **SSL**: Monitor SSL certificate expiration
4. **Cleanup**: Old build files can be removed from `/build`

### Performance
- **Compression**: Enable IIS compression for static files
- **Caching**: Configure appropriate cache headers
- **CDN**: Consider CDN for global distribution if needed

## Security Notes
- Application is purely client-side (no server processing)
- All data stays between connected devices
- No external dependencies in production build
- HTTPS required for security context