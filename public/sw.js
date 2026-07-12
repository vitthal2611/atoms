// Service worker — two jobs:
// 1. Lets the app call registration.showNotification() for richer local
//    notifications than the plain Notification() constructor.
// 2. Receives Firebase Cloud Messaging pushes and shows them EVEN WHEN THE
//    APP IS FULLY CLOSED — this is what makes the daily reminder actually
//    reach a phone. The OS wakes this worker just for the push event.
// Intentionally does NOT cache assets or intercept fetches, so it can never
// serve stale content.

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

// ─── Firebase Cloud Messaging (background pushes) ─────────────────────────
// Config values below are the same public Firebase web config already
// shipped in the built app bundle — not secret, safe in a static file.
// (Security is enforced by firestore.rules, not by hiding these IDs.)
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDY-LZIb3RZlYAH1eBcTejzGdhZ-b5PEGg",
  authDomain: "budgetbuddy-9d7da.firebaseapp.com",
  projectId: "budgetbuddy-9d7da",
  storageBucket: "budgetbuddy-9d7da.firebasestorage.app",
  messagingSenderId: "52697566663",
  appId: "1:52697566663:web:c58b872b4ef3d3efac9de2",
});

const messaging = firebase.messaging();

// Fires when a push arrives and no tab is in the foreground — this is the
// closed-browser case the client-side setTimeout could never cover.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || payload.data || {};
  self.registration.showNotification(title || "Atomic Habits", {
    body: body || "Time to check in on your habits.",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: "daily-reminder",
  });
});
