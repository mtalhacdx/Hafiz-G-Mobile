/**
 * PWA Utility Module
 * Handles service worker registration and PWA-related functionality
 */

import { registerSW } from 'virtual:pwa-register';

let updateSW = null;

/**
 * Register the Vite PWA plugin service worker and handle updates.
 */
export const registerServiceWorker = () => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Workers not supported');
    return;
  }

  updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      console.log('App is ready to work offline');
    },
    onNeedRefresh() {
      const shouldRefresh = window.confirm(
        'A new version of Hafiz G Mobile is available. Reload to update?'
      );

      if (shouldRefresh) {
        updateSW?.(true);
      }
    },
    onRegisterError(error) {
      console.error('Service Worker registration failed:', error);
    },
  });
};

/**
 * Check if app is installable (PWA)
 */
export const checkPWAInstallability = () => {
  return 'beforeinstallprompt' in window;
};

/**
 * Detect if app is running as standalone PWA
 */
export const isStandalone = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
};

/**
 * Get service worker status
 */
export const getServiceWorkerStatus = async () => {
  if (!('serviceWorker' in navigator)) {
    return { installed: false, active: false };
  }

  const registration = await navigator.serviceWorker.getRegistration();
  return {
    installed: !!registration,
    active: !!registration?.active,
  };
};

/**
 * Clear all caches
 */
export const clearAllCaches = async () => {
  if (!('caches' in window)) {
    console.warn('Caches not supported');
    return;
  }

  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map((name) => caches.delete(name)));
  console.log('All caches cleared');
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

/**
 * Send a notification
 */
export const sendNotification = (title, options = {}) => {
  if ('serviceWorker' in navigator && 'Notification' in window) {
    navigator.serviceWorker.ready.then((registration) => {
      registration.showNotification(title, {
        badge: '/pwa-192x192.png',
        icon: '/pwa-192x192.png',
        ...options,
      });
    });
  }
};

export default {
  registerServiceWorker,
  checkPWAInstallability,
  isStandalone,
  getServiceWorkerStatus,
  clearAllCaches,
  requestNotificationPermission,
  sendNotification,
};
