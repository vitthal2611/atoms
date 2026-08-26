/* Firebase Cloud Messaging service worker — shows habit reminders when the app
   is closed/backgrounded. The Firebase config is passed as query params at
   registration time (see enableHabitReminders in the app) so nothing is hardcoded. */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const params = new URLSearchParams(self.location.search);
firebase.initializeApp({
  apiKey:            params.get("apiKey"),
  authDomain:        params.get("authDomain"),
  projectId:         params.get("projectId"),
  storageBucket:     params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId:             params.get("appId"),
});

const messaging = firebase.messaging();

// Data-only messages → build the notification here (avoids double-notifications).
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  self.registration.showNotification(d.title || "Habit reminder", {
    body: d.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: d.habitId || undefined,   // one habit → one notification, replaced not stacked
    data: d,
  });
});

// Tapping the notification focuses an open tab or opens the app.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = (event.notification.data && event.notification.data.link) || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((cl) => {
      for (const c of cl) { if ("focus" in c) return c.focus(); }
      if (clients.openWindow) return clients.openWindow(link);
    })
  );
});
