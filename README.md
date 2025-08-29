# IIS 403 Forbidden Error Fix Guide

## Problem Description
When deploying a web application to IIS, you may encounter a **403 Forbidden: Access is denied** error. This typically occurs due to:
- Missing default document (index.html)
- Incorrect file permissions
- Misconfigured web.config file
- Authentication/authorization issues

## Solution Steps

### 1. Ensure Default Document Exists
IIS looks for specific default documents when accessing a directory. Make sure you have one of these files:
- `index.html` (recommended)
- `default.html`
- `default.htm`

```powershell
# If your main file has a different name, rename it to index.html
Rename-Item "your-file-name.html" "index.html"
```

### 2. Set Proper File Permissions
Grant read permissions to the necessary IIS accounts:

```powershell
# Grant permissions to IIS_IUSRS (general IIS users)
icacls "c:\inetpub\wwwroot\your-app" /grant "IIS_IUSRS:(OI)(CI)R" /T

# Grant permissions to IUSR (anonymous user)
icacls "c:\inetpub\wwwroot\your-app" /grant "IUSR:(OI)(CI)R" /T

# Grant permissions to specific application pool (replace 'your-app' with your app pool name)
icacls "c:\inetpub\wwwroot\your-app" /grant "IIS AppPool\your-app:(OI)(CI)R" /T
```

**Permission Flags Explanation:**
- `(OI)` - Object Inherit
- `(CI)` - Container Inherit  
- `R` - Read permissions
- `/T` - Apply to this folder, subfolders, and files

### 3. Check Application Pool Configuration
Verify the application pool is running and using the correct identity:

```powershell
# Import IIS module
Import-Module WebAdministration

# Check application pool status
Get-IISAppPool -Name "your-app-pool-name"

# Check identity type (should be ApplicationPoolIdentity)
Get-ItemProperty "IIS:\AppPools\your-app-pool-name" -Name processModel.identityType
```

### 4. Restart IIS Services
After making changes, restart the application pool and site:

```powershell
# Restart application pool
Restart-WebAppPool -Name "your-app-pool-name"

# Restart IIS site
Stop-IISSite -Name "your-site-name"
Start-IISSite -Name "your-site-name"
```

### 5. Troubleshoot web.config Issues
If you have a web.config file causing problems:

```powershell
# Temporarily rename web.config to test
Rename-Item "web.config" "web.config.bak"

# Test the site - if it works, the web.config was the issue
# Fix the web.config or remove it if not needed
```

## Verification Steps

1. **Check file structure:**
   ```powershell
   Get-ChildItem "c:\inetpub\wwwroot\your-app" | Select-Object Name, Length, LastWriteTime
   ```

2. **Verify permissions:**
   ```powershell
   icacls "c:\inetpub\wwwroot\your-app"
   ```

3. **Test the website:**
   - Open browser and navigate to your site
   - Check browser developer console for any JavaScript errors
   - Verify all resources load correctly

## Common Mistakes to Avoid

1. **Wrong file names** - Don't use spaces or special characters in file names
2. **Insufficient permissions** - Always grant permissions to both IIS_IUSRS and the specific app pool
3. **Complex web.config** - Start simple or without web.config, add complexity gradually
4. **Forgetting to restart** - Always restart IIS services after configuration changes

## File Structure Example
```
c:\inetpub\wwwroot\your-app\
├── index.html          # Main application file
├── assets/             # Optional: CSS, JS, images
│   ├── style.css
│   └── script.js
└── README.md           # This documentation file
```

## Useful PowerShell Commands

```powershell
# Check IIS sites
Get-IISSite

# Check application pools
Get-IISAppPool

# View IIS logs (if needed)
Get-Content "C:\inetpub\logs\LogFiles\W3SVC1\*.log" | Select-Object -Last 10

# Test if a file exists
Test-Path "c:\inetpub\wwwroot\your-app\index.html"
```

## Additional Resources

- [IIS Default Documents Configuration](https://docs.microsoft.com/en-us/iis/configuration/system.webserver/defaultdocument/)
- [IIS Application Pool Identity](https://docs.microsoft.com/en-us/iis/manage/configuring-security/application-pool-identities)
- [IIS File Permissions](https://docs.microsoft.com/en-us/iis/get-started/planning-for-security/secure-content-in-iis-through-file-system-acls)

---

**Last Updated:** August 29, 2025  
**Tested Environment:** Windows Server with IIS 10.0
