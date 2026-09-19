import { initializeApp, getApps } from "firebase/app";
import { getFirestore, initializeFirestore, doc, collection } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check for missing environment variables
export const getMissingEnvVars = () => 
  Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);

// Initialize Firebase app (handles HMR re-runs)
const hadApp = getApps().length > 0;
export const app = hadApp ? getApps()[0] : initializeApp(firebaseConfig);

// Initialize Firestore with settings
export const db = hadApp
  ? getFirestore(app)
  : initializeFirestore(app, { ignoreUndefinedProperties: true });

// Initialize Auth
export const auth = getAuth(app);

// VAPID key for push notifications
export const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Firestore reference helpers
export const firestoreRefs = {
  identities: (uid) => doc(db, "users", uid, "atomicHabits", "identities"),
  checkIns: (uid) => doc(db, "users", uid, "atomicHabits", "checkIns"),
  dailyTasks: (uid) => doc(db, "users", uid, "atomicHabits", "dailyTasks"),
  habitNotes: (uid) => doc(db, "users", uid, "atomicHabits", "habitNotes"),
  reviews: (uid) => doc(db, "users", uid, "atomicHabits", "reviews"),
  settings: (uid) => doc(db, "users", uid, "atomicHabits", "settings"),
  cohortMembers: (key) => collection(db, "cohorts", key, "members"),
  cohortMember: (key, uid) => doc(db, "cohorts", key, "members", uid),
  pushDevice: (uid, deviceId) => doc(db, "pushTokens", uid, "devices", deviceId),
};
