import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

// Replace these with actual project values when deploying to Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAsG7kmhvXwVQwFIgQxy53TBpwfqmxfrxY",
  authDomain: "costing-sample-tracking.firebaseapp.com",
  projectId: "costing-sample-tracking",
  storageBucket: "costing-sample-tracking.firebasestorage.app",
  messagingSenderId: "790271841244",
  appId: "1:790271841244:web:f1b4ea1a1e17028575b519"
};

// Check if credentials are valid (i.e. not empty and not placeholders)
const isValidConfig = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId;

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app);
const isMockMode = false;

export { app, auth, db, functions, isMockMode };

/**
 * Toggle Mock Mode utility for development demoing
 */
export function toggleMockMode(enable) {
  localStorage.setItem("firebase_mock_override", enable ? "true" : "false");
  window.location.reload();
}
