import { getMessaging, getToken, isSupported } from "firebase/messaging";
import { setDoc } from "firebase/firestore";
import { app, vapidKey } from "../config/firebase.js";
import { firestoreRefs } from "../config/firebase.js";
import { getDeviceId } from "../utils/storageUtils.js";

/**
 * Enable push notifications for habit reminders
 */
export async function enableHabitReminders(uid) {
  // Check if messaging is supported
  if (!(await isSupported().catch(() => false))) {
    throw new Error("unsupported");
  }
  
  if (!vapidKey) {
    throw new Error("no-vapid");
  }
  
  // Request notification permission
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    throw new Error("denied");
  }
  
  // Register service worker with Firebase config
  const { apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId } = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  
  const swUrl = "/firebase-messaging-sw.js?" + new URLSearchParams({
    apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId,
  }).toString();
  
  const reg = await navigator.serviceWorker.register(swUrl);
  
  // Get FCM token
  const token = await getToken(getMessaging(app), {
    vapidKey,
    serviceWorkerRegistration: reg
  });
  
  if (!token) {
    throw new Error("no-token");
  }
  
  // Save token to Firestore
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const deviceId = getDeviceId();
  
  await setDoc(firestoreRefs.pushDevice(uid, deviceId), {
    uid,
    token,
    timezone,
    updatedAt: Date.now()
  });
  
  return token;
}
