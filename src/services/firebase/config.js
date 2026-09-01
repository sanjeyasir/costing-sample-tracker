import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAnalytics, isSupported } from "firebase/analytics";

// Environment-aware Firebase configuration (supports dev and prod via .env files)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAsG7kmhvXwVQwFIgQxy53TBpwfqmxfrxY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "costing-sample-tracking.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "costing-sample-tracking",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "costing-sample-tracking.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "790271841244",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:790271841244:web:f1b4ea1a1e17028575b519",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);

let analytics = null;
if (typeof window !== "undefined" && firebaseConfig.measurementId) {
  isSupported()
    .then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    })
    .catch(() => {});
}

const isMockMode = false;

export { app, auth, db, functions, analytics, isMockMode, firebaseConfig };

/**
 * Toggle Mock Mode utility for development demoing
 */
export function toggleMockMode(enable) {
  localStorage.setItem("firebase_mock_override", enable ? "true" : "false");
  window.location.reload();
}
