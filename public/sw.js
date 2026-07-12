// Minimal service worker — exists solely so the app can call
// registration.showNotification(), which produces richer, more reliable
// notifications than the plain Notification() constructor (especially on
// Android). Intentionally does NOT cache assets or intercept fetches, so it
// can never serve stale content — that's a separate concern for another day.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Clicking the notification focuses/opens the app instead of just dismissing.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
