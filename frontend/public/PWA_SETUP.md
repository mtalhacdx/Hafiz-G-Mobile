# PWA Setup Guide

This project has been configured as a Progressive Web App (PWA) using `vite-plugin-pwa`. Below are the required steps and information.

## What's Configured

✅ **Service Worker Registration** - Automatically registers and manages the service worker
✅ **Manifest.json** - Web app manifest with metadata and app settings
✅ **PWA Meta Tags** - HTML meta tags for iOS and other platforms
✅ **Workbox Integration** - Advanced caching strategies for offline functionality
✅ **Update Detection** - Automatic detection and prompting for app updates

## Required Assets

You need to add the following image files to the `/frontend/public/` directory:

### Icon Files (Required)

- `pwa-192x192.png` - 192x192 icon for Android home screen
- `pwa-512x512.png` - 512x512 icon for splash screens
- `pwa-maskable-192x192.png` - 192x192 maskable icon (design without safe zone)
- `pwa-maskable-512x512.png` - 512x512 maskable icon
- `apple-touch-icon.png` - 180x180 icon for iOS home screen
- `masked-icon.svg` - SVG icon for Safari pinned tab

### Screenshot Files (Optional but Recommended)

- `screenshot-1.png` - 540x720 narrow format screenshot
- `screenshot-2.png` - 1280x720 wide format screenshot

## How to Generate Icon Files

### Using Online Tools

1. **Android Asset Studio**: https://romannurik.github.io/AndroidAssetStudio/
2. **PWA Asset Generator**: https://www.npmjs.com/package/pwa-asset-generator
3. **Favicon Generator**: https://www.favicon-generator.org/

### Using pwa-asset-generator (Recommended)

```bash
npm install -g pwa-asset-generator

# Generate all required PWA assets from a source image
pwa-asset-generator logo.png ./public --favicon --splash-only --type png

# Generate maskable icons
pwa-asset-generator logo.png ./public/maskable --maskable-only --type png
```

## Installation & Build

### Development

```bash
cd frontend
npm install vite-plugin-pwa --legacy-peer-deps
npm run dev
```

The PWA will be available at `http://localhost:5173`

### Production Build

```bash
npm run build
npm run preview
```

## Testing PWA Features

### Test on Desktop

1. Open DevTools (F12)
2. Go to **Application** → **Service Workers** to verify registration
3. Check **Application** → **Manifest** to verify manifest loading
4. Use Network tab and set to "Offline" to test offline functionality

### Test on Mobile

1. Open the site on your mobile device
2. Look for "Add to Home Screen" or "Install" prompt
3. Click to install the app
4. App will run in standalone mode

## PWA Utilities

The `src/utils/pwa.js` file provides utilities for PWA functionality:

```javascript
import {
  registerServiceWorker,
  checkPWAInstallability,
  isStandalone,
  getServiceWorkerStatus,
  clearAllCaches,
  requestNotificationPermission,
  sendNotification,
} from "./utils/pwa";

// Check if currently running as standalone PWA
if (isStandalone()) {
  console.log("Running as installed PWA");
}

// Request notification permission
await requestNotificationPermission();

// Send a notification
sendNotification("Title", {
  body: "Notification message",
  tag: "notification-1",
});
```

## Caching Strategy

The PWA uses the following caching strategies (configured in `vite.config.mjs`):

- **API Requests** (`/api/**`): Network First (5-minute cache)
- **CDN/External**: Stale While Revalidate (24-hour cache)
- **HTML/Assets**: Automatically cached by service worker

## Configuration Details

See `vite.config.mjs` for:

- `registerType: "autoUpdate"` - Automatically updates the service worker
- `workbox` - Advanced caching and offline strategies
- `manifest` - App metadata and app shortcuts
- `devOptions` - Development-mode settings

## Browser Support

| Feature        | Chrome | Firefox | Safari | Edge |
| -------------- | ------ | ------- | ------ | ---- |
| PWA Install    | ✅     | ⚠️      | ✅     | ✅   |
| Service Worker | ✅     | ✅      | ✅     | ✅   |
| Offline Mode   | ✅     | ✅      | ✅     | ✅   |
| Notifications  | ✅     | ✅      | ⚠️     | ✅   |

## Troubleshooting

### Service Worker Not Registering

- Check browser console for errors
- Verify service worker file path is correct
- Ensure app is served over HTTPS (or localhost for testing)

### App Not Installable

- Missing manifest.json
- Missing required icon files
- Service worker not properly registered
- HTTPS required in production

### Offline Mode Not Working

- Verify service worker is active in DevTools
- Check Network tab to see which resources are cached
- Ensure API requests have proper caching rules

## Next Steps

1. **Generate icon files** using the tools mentioned above
2. **Add generated icons** to `/public/` directory
3. **Update manifest.json** if needed (theme colors, app name, etc.)
4. **Test PWA features** in DevTools
5. **Deploy to HTTPS** for production PWA functionality

## Resources

- [MDN: Progressive Web Apps](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Web.dev: PWA Checklist](https://web.dev/pwa-checklist/)
- [PWA Builder](https://www.pwabuilder.com/)
